import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FixedClock, InvalidStateTransitionError, ValidationError } from '@nabd/shared';

import {
  type KycApplicationState,
  type SubmittedDocument,
  applyReview,
  assertKycTransition,
  canTransitionKyc,
  checkDocuments,
  findDuplicateContent,
  isVerificationExpired,
  needsRenewalPrompt,
  prepareSubmission,
  requiredDocuments,
  validateDocumentUpload,
} from './kyc-workflow.js';

function doc(type: SubmittedDocument['type'], sha256 = `hash-${type}`): SubmittedDocument {
  return {
    type,
    storageKey: `kyc/${type}`,
    sha256,
    sizeBytes: 1024,
    contentType: 'image/jpeg',
    uploadedAt: new Date('2026-09-01T00:00:00Z'),
  };
}

function application(overrides: Partial<KycApplicationState> = {}): KycApplicationState {
  return {
    id: 'kyc_1',
    userId: 'user_1',
    status: 'PENDING',
    level: 'FULL',
    documents: [doc('ID_FRONT'), doc('ID_BACK'), doc('SELFIE')],
    submittedAt: null,
    reviewedAt: null,
    expiresAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

describe('KYC state machine', () => {
  it('permits the ordinary path', () => {
    assert.equal(canTransitionKyc('NOT_STARTED', 'PENDING'), true);
    assert.equal(canTransitionKyc('PENDING', 'UNDER_REVIEW'), true);
    assert.equal(canTransitionKyc('UNDER_REVIEW', 'VERIFIED'), true);
  });

  it('lets a rejected applicant try again', () => {
    assert.equal(canTransitionKyc('REJECTED', 'PENDING'), true);
  });

  it('lets a verification lapse', () => {
    // Verification is not permanent: the document it was based on expires.
    // Without this edge a wallet verified once stays verified forever.
    assert.equal(canTransitionKyc('VERIFIED', 'EXPIRED'), true);
    assert.equal(canTransitionKyc('EXPIRED', 'PENDING'), true);
  });

  it('refuses to jump straight to verified', () => {
    assert.equal(canTransitionKyc('NOT_STARTED', 'VERIFIED'), false);
    assert.equal(canTransitionKyc('PENDING', 'VERIFIED'), false);
    assert.throws(
      () => assertKycTransition('NOT_STARTED', 'VERIFIED'),
      InvalidStateTransitionError,
    );
  });

  it('refuses to un-reject without a fresh application', () => {
    assert.equal(canTransitionKyc('REJECTED', 'VERIFIED'), false);
  });
});

describe('Document requirements', () => {
  it('requires strictly more at each level', () => {
    const basic = requiredDocuments('BASIC');
    const full = requiredDocuments('FULL');
    const enhanced = requiredDocuments('ENHANCED');

    // A level reachable with fewer documents than the level below would be a
    // hole straight through the wallet tiering.
    for (const d of basic) assert.ok(full.includes(d), `FULL must also require ${d}`);
    for (const d of full)
      assert.ok(enhanced.includes(d), `ENHANCED must also require ${d}`);
    assert.ok(full.length > basic.length);
    assert.ok(enhanced.length > full.length);
  });

  it('reports exactly what is missing', () => {
    const check = checkDocuments('ENHANCED', [doc('ID_FRONT'), doc('SELFIE')]);
    assert.equal(check.complete, false);
    assert.deepEqual([...check.missing].sort(), ['ID_BACK', 'PROOF_OF_ADDRESS']);
  });

  it('accepts a complete set', () => {
    const check = checkDocuments('FULL', [doc('ID_FRONT'), doc('ID_BACK'), doc('SELFIE')]);
    assert.equal(check.complete, true);
    assert.equal(check.missing.length, 0);
  });

  it('catches the same file submitted for two document types', () => {
    // The commonest way an incomplete application passes a naive completeness
    // check: one photo uploaded as both the front and the back of an ID.
    const sameFile = 'identical-sha256';
    const duplicates = findDuplicateContent([
      doc('ID_FRONT', sameFile),
      doc('ID_BACK', sameFile),
      doc('SELFIE', 'different'),
    ]);
    assert.deepEqual(duplicates, [sameFile]);
  });
});

describe('Document upload validation', () => {
  it('accepts the permitted types', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'application/pdf']) {
      assert.doesNotThrow(() => validateDocumentUpload({ contentType, sizeBytes: 1024 }));
    }
  });

  it("rejects anything that renders in a reviewer's browser", () => {
    // SVG and HTML are XSS aimed squarely at the compliance officer who opens
    // the document.
    for (const contentType of [
      'image/svg+xml',
      'text/html',
      'application/javascript',
      'application/zip',
      'application/octet-stream',
    ]) {
      assert.throws(
        () => validateDocumentUpload({ contentType, sizeBytes: 1024 }),
        ValidationError,
        `${contentType} must be rejected`,
      );
    }
  });

  it('rejects empty and oversized files', () => {
    assert.throws(
      () => validateDocumentUpload({ contentType: 'image/jpeg', sizeBytes: 0 }),
      ValidationError,
    );
    assert.throws(
      () =>
        validateDocumentUpload({ contentType: 'image/jpeg', sizeBytes: 11 * 1024 * 1024 }),
      ValidationError,
    );
  });
});

describe('Submission', () => {
  it('accepts a complete application', () => {
    const result = prepareSubmission(application());
    assert.equal(result.ok, true);
  });

  it('reports missing documents rather than throwing', () => {
    // An incomplete application is an expected state the UI must render, not
    // an exceptional one.
    const result = prepareSubmission(application({ documents: [doc('ID_FRONT')] }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.missing.includes('SELFIE'));
      assert.ok(result.missing.includes('ID_BACK'));
    }
  });

  it('refuses an application whose documents are the same file twice', () => {
    const result = prepareSubmission(
      application({
        documents: [
          doc('ID_FRONT', 'same'),
          doc('ID_BACK', 'same'),
          doc('SELFIE', 'other'),
        ],
      }),
    );
    assert.equal(result.ok, false);
  });

  it('refuses to submit from a state that cannot reach review', () => {
    // NOT_STARTED and REJECTED can only go to PENDING first — an application
    // cannot skip document collection.
    for (const status of ['NOT_STARTED', 'REJECTED', 'EXPIRED'] as const) {
      assert.throws(
        () => prepareSubmission(application({ status })),
        InvalidStateTransitionError,
        `${status} must not reach review directly`,
      );
    }
  });

  it('allows a verified customer to be put back under review', () => {
    // Deliberate: periodic re-screening and compliance triggers must be able
    // to re-open a verified customer without first un-verifying them.
    const result = prepareSubmission(application({ status: 'VERIFIED' }));
    assert.equal(result.ok, true);
  });
});

describe('Review decisions', () => {
  const clock = new FixedClock(Date.parse('2026-09-04T00:00:00Z'));
  const underReview = application({ status: 'UNDER_REVIEW' });

  it('approves and sets an expiry', () => {
    const result = applyReview(
      underReview,
      { outcome: 'APPROVE', reviewerId: 'admin_1' },
      clock,
    );
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.level, 'FULL');
    assert.ok(result.expiresAt !== null, 'verification must expire');
    assert.ok(
      (result.expiresAt as Date).getTime() > clock.nowMs(),
      'expiry must be in the future',
    );
  });

  it('rejects with a reason', () => {
    const result = applyReview(
      underReview,
      { outcome: 'REJECT', reason: 'Document is illegible', reviewerId: 'admin_1' },
      clock,
    );
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.rejectionReason, 'Document is illegible');
  });

  it('refuses a rejection with no reason', () => {
    // A decision the customer cannot act on is useless to them.
    assert.throws(
      () => applyReview(underReview, { outcome: 'REJECT', reviewerId: 'admin_1' }, clock),
      ValidationError,
    );
    assert.throws(
      () =>
        applyReview(
          underReview,
          { outcome: 'REJECT', reason: '   ', reviewerId: 'admin_1' },
          clock,
        ),
      ValidationError,
    );
  });

  it('refuses an unattributed decision', () => {
    // This decision controls how much money the customer may move; it must be
    // auditable to a person.
    assert.throws(
      () => applyReview(underReview, { outcome: 'APPROVE', reviewerId: '' }, clock),
      ValidationError,
    );
  });

  it('allows granting a lower level than applied for', () => {
    const result = applyReview(
      underReview,
      { outcome: 'APPROVE', reviewerId: 'admin_1', grantedLevel: 'BASIC' },
      clock,
    );
    assert.equal(result.level, 'BASIC');
  });

  it('refuses to grant a level above the one applied for', () => {
    // The documents for the higher level were never collected.
    assert.throws(
      () =>
        applyReview(
          underReview,
          { outcome: 'APPROVE', reviewerId: 'admin_1', grantedLevel: 'ENHANCED' },
          clock,
        ),
      ValidationError,
    );
  });

  it('refuses to approve when a required document is missing', () => {
    assert.throws(
      () =>
        applyReview(
          application({ status: 'UNDER_REVIEW', documents: [doc('ID_FRONT')] }),
          { outcome: 'APPROVE', reviewerId: 'admin_1' },
          clock,
        ),
      ValidationError,
    );
  });
});

describe('Verification expiry', () => {
  const now = new Date('2026-09-04T00:00:00Z');

  it('detects a lapsed verification', () => {
    assert.equal(
      isVerificationExpired(
        { status: 'VERIFIED', expiresAt: new Date('2026-09-03T00:00:00Z') },
        now,
      ),
      true,
    );
    assert.equal(
      isVerificationExpired(
        { status: 'VERIFIED', expiresAt: new Date('2027-09-03T00:00:00Z') },
        now,
      ),
      false,
    );
  });

  it('does not report a non-verified application as expired', () => {
    assert.equal(
      isVerificationExpired(
        { status: 'PENDING', expiresAt: new Date('2020-01-01T00:00:00Z') },
        now,
      ),
      false,
    );
  });

  it('prompts for renewal before the lapse, not after', () => {
    const inTwoWeeks = new Date(now.getTime() + 14 * 86_400_000);
    const inSixMonths = new Date(now.getTime() + 180 * 86_400_000);
    const lastWeek = new Date(now.getTime() - 7 * 86_400_000);

    assert.equal(
      needsRenewalPrompt({ status: 'VERIFIED', expiresAt: inTwoWeeks }, now),
      true,
    );
    assert.equal(
      needsRenewalPrompt({ status: 'VERIFIED', expiresAt: inSixMonths }, now),
      false,
    );
    assert.equal(
      needsRenewalPrompt({ status: 'VERIFIED', expiresAt: lastWeek }, now),
      false,
      'already expired is a different state, handled by isVerificationExpired',
    );
  });
});
