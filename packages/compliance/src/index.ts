export * from './kyc-workflow.js';

/**
 * Compliance provider contracts.
 *
 * Every screening dependency is an adapter. The `Mock*` implementations exist
 * so the KYC and case-management workflows can be built and tested end to end
 * before a vendor contract exists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A MOCK SANCTIONS SCREEN IS NOT A SANCTIONS SCREEN.
 *
 * Mock adapters must never be presented as, or relied upon as, real screening.
 * `handlesRealScreening` is false on every mock, and the API's production
 * bootstrap refuses to start when a mock is selected. Screening against
 * invented data and calling it a sanctions check is a regulatory offence, not
 * a shortcut.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { KycStatus, RiskLevel } from '@nabd/shared';

export interface ComplianceProviderIdentity {
  readonly name: string;
  /** False for every mock. Production refuses to boot with a mock selected. */
  readonly handlesRealScreening: boolean;
}

// ── identity verification ───────────────────────────────────────────────────

export interface KycSubject {
  readonly fullName: string;
  readonly dateOfBirth: string;
  readonly nationality: string;
  /** Handled as RESTRICTED data: encrypted at rest, never logged. */
  readonly nationalId: string;
  readonly phone: string;
  readonly email?: string;
  readonly address?: string;
}

export interface KycResult {
  readonly providerRef: string;
  readonly status: KycStatus;
  readonly level: 'BASIC' | 'FULL' | 'ENHANCED';
  readonly rejectionReason?: string;
  readonly expiresAt?: Date;
}

export interface KycProvider {
  readonly identity: ComplianceProviderIdentity;
  submit(subject: KycSubject, idempotencyKey: string): Promise<KycResult>;
  getStatus(providerRef: string): Promise<KycResult>;
  /** Pre-signed, short-lived upload target. Bytes never pass through the API. */
  requestDocumentUpload(
    providerRef: string,
    type: string,
  ): Promise<{ uploadUrl: string; expiresAt: Date }>;
}

// ── screening ───────────────────────────────────────────────────────────────

export interface ScreeningSubject {
  readonly fullName: string;
  readonly dateOfBirth?: string;
  readonly nationality?: string;
  readonly country?: string;
}

export interface ScreeningMatch {
  readonly listName: string;
  readonly matchedName: string;
  /** 0–100. Screening returns candidates, not verdicts. */
  readonly score: number;
  readonly reference: string;
}

export interface ScreeningResult {
  readonly providerRef: string;
  readonly clear: boolean;
  readonly matches: readonly ScreeningMatch[];
  readonly screenedAt: Date;
}

export interface SanctionsProvider {
  readonly identity: ComplianceProviderIdentity;
  screen(subject: ScreeningSubject, idempotencyKey: string): Promise<ScreeningResult>;
  /** Re-screen the existing book when a list changes. */
  rescreen(providerRef: string): Promise<ScreeningResult>;
}

export interface PepProvider {
  readonly identity: ComplianceProviderIdentity;
  screen(subject: ScreeningSubject, idempotencyKey: string): Promise<ScreeningResult>;
}

// ── mocks ───────────────────────────────────────────────────────────────────

const MOCK_IDENTITY: ComplianceProviderIdentity = {
  name: 'mock',
  handlesRealScreening: false,
};

/**
 * Returns "clear" for everything.
 *
 * This is a workflow stub, nothing more. It exists so the case-management path
 * can be exercised; it makes no assertion about any real person and must never
 * be treated as evidence that a customer was screened.
 */
export class MockSanctionsProvider implements SanctionsProvider {
  readonly identity: ComplianceProviderIdentity = {
    ...MOCK_IDENTITY,
    name: 'mock-sanctions',
  };

  async screen(
    _subject: ScreeningSubject,
    idempotencyKey: string,
  ): Promise<ScreeningResult> {
    return {
      providerRef: `mock-screen-${idempotencyKey}`,
      clear: true,
      matches: [],
      screenedAt: new Date(),
    };
  }

  async rescreen(providerRef: string): Promise<ScreeningResult> {
    return { providerRef, clear: true, matches: [], screenedAt: new Date() };
  }
}

export class MockPepProvider implements PepProvider {
  readonly identity: ComplianceProviderIdentity = { ...MOCK_IDENTITY, name: 'mock-pep' };

  async screen(
    _subject: ScreeningSubject,
    idempotencyKey: string,
  ): Promise<ScreeningResult> {
    return {
      providerRef: `mock-pep-${idempotencyKey}`,
      clear: true,
      matches: [],
      screenedAt: new Date(),
    };
  }
}

export class MockKycProvider implements KycProvider {
  readonly identity: ComplianceProviderIdentity = { ...MOCK_IDENTITY, name: 'mock-kyc' };

  async submit(_subject: KycSubject, idempotencyKey: string): Promise<KycResult> {
    return {
      providerRef: `mock-kyc-${idempotencyKey}`,
      // UNDER_REVIEW rather than VERIFIED: the mock must not teach the rest of
      // the system that verification is instant and always succeeds.
      status: 'UNDER_REVIEW',
      level: 'BASIC',
    };
  }

  async getStatus(providerRef: string): Promise<KycResult> {
    return { providerRef, status: 'UNDER_REVIEW', level: 'BASIC' };
  }

  async requestDocumentUpload(): Promise<{ uploadUrl: string; expiresAt: Date }> {
    return {
      uploadUrl: 'https://mock-kyc.invalid/upload',
      expiresAt: new Date(Date.now() + 15 * 60_000),
    };
  }
}

// ── case management ─────────────────────────────────────────────────────────

export interface ComplianceDecision {
  readonly caseId: string;
  readonly outcome: 'CLEARED' | 'ESCALATED' | 'REPORTED' | 'BLOCKED';
  /** Required. A decision without a stated reason is not reviewable. */
  readonly reason: string;
  readonly decidedBy: string;
  readonly decidedAt: Date;
}

/**
 * Whether a screening result needs a human.
 *
 * A high-scoring match is never auto-blocked and never auto-cleared: a false
 * positive on a common name would freeze an innocent customer's funds, and a
 * false negative would let a sanctioned party through. Both outcomes require a
 * person to own the decision.
 */
export function requiresHumanReview(result: ScreeningResult): boolean {
  return result.matches.some((m) => m.score >= 70);
}

export function severityOf(result: ScreeningResult): RiskLevel {
  const top = Math.max(0, ...result.matches.map((m) => m.score));
  if (top >= 90) return 'CRITICAL';
  if (top >= 70) return 'HIGH';
  if (top >= 40) return 'MEDIUM';
  return 'LOW';
}
