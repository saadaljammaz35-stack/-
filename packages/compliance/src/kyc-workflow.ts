/**
 * KYC workflow.
 *
 * Verification is what unlocks a wallet: `tierForKyc` in `@nabd/ledger` maps
 * the outcome here directly onto how much a customer may hold and move. That
 * makes this file a money control, not a form — and it is why every transition
 * below is explicit and every default fails closed.
 */

import {
  type Clock,
  InvalidStateTransitionError,
  type KycStatus,
  systemClock,
  ValidationError,
} from '@nabd/shared';

export type KycLevel = 'BASIC' | 'FULL' | 'ENHANCED';

export type KycDocumentType =
  | 'ID_FRONT'
  | 'ID_BACK'
  | 'SELFIE'
  | 'PROOF_OF_ADDRESS'
  | 'OTHER';

/**
 * Permitted status transitions.
 *
 * `VERIFIED → EXPIRED` exists because verification is not permanent: an
 * identity document expires, and a customer verified against an expired
 * document is no longer verified. Without this edge, a wallet verified once
 * stays verified forever.
 */
const TRANSITIONS: Readonly<Record<KycStatus, readonly KycStatus[]>> = {
  NOT_STARTED: ['PENDING'],
  // PENDING covers "documents being collected".
  PENDING: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'PENDING'],
  // A rejected applicant may try again; that is a new PENDING application.
  REJECTED: ['PENDING'],
  VERIFIED: ['EXPIRED', 'UNDER_REVIEW'],
  EXPIRED: ['PENDING'],
};

export function canTransitionKyc(from: KycStatus, to: KycStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertKycTransition(from: KycStatus, to: KycStatus): void {
  if (!canTransitionKyc(from, to)) {
    throw new InvalidStateTransitionError('KycApplication', from, to);
  }
}

/** Statuses in which the customer may actually use their wallet. */
export function isKycUsable(status: KycStatus): boolean {
  return status === 'VERIFIED';
}

// ── document requirements ───────────────────────────────────────────────────

/**
 * What each level requires.
 *
 * Higher levels require strictly more, and `requiredDocuments` is the single
 * place that says so — a level that could be reached with fewer documents than
 * the level below it would be a hole straight through the tiering.
 */
const REQUIRED_DOCUMENTS: Readonly<Record<KycLevel, readonly KycDocumentType[]>> = {
  BASIC: ['ID_FRONT', 'SELFIE'],
  FULL: ['ID_FRONT', 'ID_BACK', 'SELFIE'],
  ENHANCED: ['ID_FRONT', 'ID_BACK', 'SELFIE', 'PROOF_OF_ADDRESS'],
};

export function requiredDocuments(level: KycLevel): readonly KycDocumentType[] {
  return REQUIRED_DOCUMENTS[level];
}

export interface SubmittedDocument {
  readonly type: KycDocumentType;
  readonly storageKey: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly uploadedAt: Date;
}

export interface DocumentCheck {
  readonly complete: boolean;
  readonly missing: readonly KycDocumentType[];
  readonly duplicates: readonly KycDocumentType[];
}

export function checkDocuments(
  level: KycLevel,
  submitted: readonly SubmittedDocument[],
): DocumentCheck {
  const required = requiredDocuments(level);
  const present = submitted.map((d) => d.type);

  const missing = required.filter((type) => !present.includes(type));
  const duplicates = [...new Set(present.filter((t, i) => present.indexOf(t) !== i))];

  return { complete: missing.length === 0, missing, duplicates };
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

/**
 * Validate an upload before it is accepted.
 *
 * The content-type allow-list is deliberately narrow. A KYC store that accepts
 * arbitrary types becomes a file-hosting service inside the compliance
 * perimeter, and anything that renders (SVG, HTML) is an XSS vector aimed at
 * the reviewer who opens it.
 */
export function validateDocumentUpload(params: {
  contentType: string;
  sizeBytes: number;
}): void {
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(params.contentType)) {
    throw new ValidationError('Unsupported document type', {
      contentType: params.contentType,
      allowed: ALLOWED_DOCUMENT_TYPES,
    });
  }
  if (params.sizeBytes <= 0) {
    throw new ValidationError('Document is empty');
  }
  if (params.sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new ValidationError('Document exceeds the maximum size', {
      sizeBytes: params.sizeBytes,
      maxBytes: MAX_DOCUMENT_BYTES,
    });
  }
}

/**
 * Detect the same file submitted for two different document types.
 *
 * A customer uploading one photo as both "ID front" and "ID back" is the
 * commonest way an incomplete application passes a naive completeness check.
 */
export function findDuplicateContent(
  submitted: readonly SubmittedDocument[],
): readonly string[] {
  const byHash = new Map<string, KycDocumentType[]>();
  for (const doc of submitted) {
    byHash.set(doc.sha256, [...(byHash.get(doc.sha256) ?? []), doc.type]);
  }
  return [...byHash.entries()]
    .filter(([, types]) => types.length > 1)
    .map(([hash]) => hash);
}

// ── submission and review ───────────────────────────────────────────────────

export interface KycApplicationState {
  readonly id: string;
  readonly userId: string;
  readonly status: KycStatus;
  readonly level: KycLevel;
  readonly documents: readonly SubmittedDocument[];
  readonly submittedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly rejectionReason: string | null;
}

export type SubmitOutcome =
  | { readonly ok: true; readonly nextStatus: 'UNDER_REVIEW' }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly missing: readonly KycDocumentType[];
    };

/**
 * Move an application from collecting documents to awaiting review.
 *
 * Returns a failure rather than throwing when documents are missing: an
 * incomplete application is an expected state the UI must render, not an
 * exceptional one.
 */
export function prepareSubmission(application: KycApplicationState): SubmitOutcome {
  assertKycTransition(application.status, 'UNDER_REVIEW');

  const check = checkDocuments(application.level, application.documents);
  if (!check.complete) {
    return { ok: false, reason: 'Missing required documents', missing: check.missing };
  }

  const duplicated = findDuplicateContent(application.documents);
  if (duplicated.length > 0) {
    return {
      ok: false,
      reason: 'The same file was submitted for more than one document type',
      missing: [],
    };
  }

  return { ok: true, nextStatus: 'UNDER_REVIEW' };
}

export interface ReviewDecision {
  readonly outcome: 'APPROVE' | 'REJECT';
  /** Required on rejection: a decision the customer cannot act on is useless. */
  readonly reason?: string;
  readonly reviewerId: string;
  /** Approving to a level lower than requested is a legitimate outcome. */
  readonly grantedLevel?: KycLevel;
}

export interface ReviewResult {
  readonly status: KycStatus;
  readonly level: KycLevel;
  readonly expiresAt: Date | null;
  readonly rejectionReason: string | null;
}

/** Verification is valid for two years, then must be refreshed. */
export const VERIFICATION_VALIDITY_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export function applyReview(
  application: KycApplicationState,
  decision: ReviewDecision,
  clock: Clock = systemClock,
): ReviewResult {
  if (decision.reviewerId.trim() === '') {
    // An unattributed decision cannot be audited, and this decision controls
    // how much money the customer may move.
    throw new ValidationError('A KYC decision requires a reviewer id');
  }

  if (decision.outcome === 'REJECT') {
    if (decision.reason === undefined || decision.reason.trim() === '') {
      throw new ValidationError('A rejection requires a reason');
    }
    assertKycTransition(application.status, 'REJECTED');
    return {
      status: 'REJECTED',
      level: application.level,
      expiresAt: null,
      rejectionReason: decision.reason,
    };
  }

  assertKycTransition(application.status, 'VERIFIED');

  // A reviewer may grant a lower level than requested, but never a higher one:
  // the documents for the higher level were never collected.
  const requested = application.level;
  const granted = decision.grantedLevel ?? requested;
  const order: KycLevel[] = ['BASIC', 'FULL', 'ENHANCED'];
  if (order.indexOf(granted) > order.indexOf(requested)) {
    throw new ValidationError(
      'Cannot grant a level above the one applied for — its documents were never collected',
      { requested, granted },
    );
  }

  const check = checkDocuments(granted, application.documents);
  if (!check.complete) {
    throw new ValidationError('Cannot approve: required documents are missing', {
      missing: check.missing,
    });
  }

  return {
    status: 'VERIFIED',
    level: granted,
    expiresAt: new Date(clock.nowMs() + VERIFICATION_VALIDITY_MS),
    rejectionReason: null,
  };
}

/**
 * Whether a verification has lapsed.
 *
 * Run on a schedule. A customer verified against a document that has since
 * expired is not verified, and their wallet tier must fall accordingly.
 */
export function isVerificationExpired(
  application: Pick<KycApplicationState, 'status' | 'expiresAt'>,
  now: Date,
): boolean {
  if (application.status !== 'VERIFIED') return false;
  return application.expiresAt !== null && application.expiresAt.getTime() <= now.getTime();
}

/** Days remaining before a verification lapses; negative once it has. */
export function daysUntilExpiry(expiresAt: Date | null, now: Date): number | null {
  if (expiresAt === null) return null;
  return Math.floor((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Customers within this window should be prompted to re-verify. */
export const RENEWAL_PROMPT_DAYS = 30;

export function needsRenewalPrompt(
  application: Pick<KycApplicationState, 'status' | 'expiresAt'>,
  now: Date,
): boolean {
  if (application.status !== 'VERIFIED') return false;
  const days = daysUntilExpiry(application.expiresAt, now);
  return days !== null && days <= RENEWAL_PROMPT_DAYS && days >= 0;
}
