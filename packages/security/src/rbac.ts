/**
 * Admin role-based access control.
 *
 * This file is the executable form of `docs/compliance/access-control-matrix.md`.
 * A matrix that lives only in a document drifts from the code within a release;
 * here the document and the enforcement are the same table, and the tests below
 * assert the invariants that matter most.
 *
 * Two of those invariants are absolute and hold for every role, including
 * SUPER_ADMIN:
 *
 *   1. No admin role can move customer money.
 *   2. No admin role can alter or delete a ledger entry or an audit log.
 *
 * The second is additionally enforced by database triggers, so a compromised
 * application cannot grant itself what this table denies.
 */

import { type AdminRole, ForbiddenError } from '@nabd/shared';

export const Permission = {
  // Customers
  USER_READ: 'user:read',
  USER_SUSPEND: 'user:suspend',
  USER_UPDATE: 'user:update',

  // Money — deliberately narrow
  ACCOUNT_READ: 'account:read',
  ACCOUNT_FREEZE: 'account:freeze',
  /** Post a manual adjustment. Requires a reason and an operator id. */
  LEDGER_ADJUST: 'ledger:adjust',
  /** Post a reversal of an existing journal. */
  LEDGER_REVERSE: 'ledger:reverse',
  LEDGER_READ: 'ledger:read',

  // KYC and compliance
  KYC_READ: 'kyc:read',
  KYC_DECIDE: 'kyc:decide',
  KYC_DOCUMENT_VIEW: 'kyc:document:view',
  COMPLIANCE_CASE_READ: 'compliance:read',
  COMPLIANCE_CASE_DECIDE: 'compliance:decide',

  // Risk
  FRAUD_CASE_READ: 'fraud:read',
  FRAUD_CASE_DECIDE: 'fraud:decide',
  RISK_RULES_UPDATE: 'risk:rules:update',

  // Support
  TICKET_READ: 'ticket:read',
  TICKET_RESPOND: 'ticket:respond',

  // Operations
  RECONCILIATION_RUN: 'ops:reconcile',
  SETTLEMENT_MANAGE: 'ops:settlement',

  // Administration
  ADMIN_USER_READ: 'admin:read',
  ADMIN_USER_MANAGE: 'admin:manage',
  ROLE_ASSIGN: 'admin:role:assign',
  SYSTEM_CONFIG: 'system:config',

  // Audit
  AUDIT_READ: 'audit:read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Permissions that do not exist for anyone.
 *
 * Listed explicitly rather than simply omitted, so that a future change that
 * tries to add one is an obvious, reviewable act rather than a quiet addition
 * to somebody's role.
 */
export const FORBIDDEN_TO_ALL = [
  'customer:transfer', // move a customer's money on their behalf
  'ledger:entry:update',
  'ledger:entry:delete',
  'audit:update',
  'audit:delete',
] as const;

const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly Permission[]>> = {
  SUPER_ADMIN: [
    Permission.USER_READ,
    Permission.USER_SUSPEND,
    Permission.USER_UPDATE,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_FREEZE,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.COMPLIANCE_CASE_READ,
    Permission.FRAUD_CASE_READ,
    Permission.TICKET_READ,
    Permission.RECONCILIATION_RUN,
    Permission.ADMIN_USER_READ,
    Permission.ADMIN_USER_MANAGE,
    Permission.ROLE_ASSIGN,
    Permission.SYSTEM_CONFIG,
    Permission.AUDIT_READ,
    // Note what is absent: LEDGER_ADJUST and LEDGER_REVERSE. Separation of
    // duties — the role that grants permissions must not also be the role that
    // moves money, or it can grant itself the ability and use it in one step.
  ],

  ADMIN: [
    Permission.USER_READ,
    Permission.USER_SUSPEND,
    Permission.USER_UPDATE,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_FREEZE,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.COMPLIANCE_CASE_READ,
    Permission.FRAUD_CASE_READ,
    Permission.TICKET_READ,
    Permission.ADMIN_USER_READ,
    Permission.AUDIT_READ,
  ],

  COMPLIANCE: [
    Permission.USER_READ,
    Permission.USER_SUSPEND,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_FREEZE,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.KYC_DECIDE,
    // The only role that may open an identity document.
    Permission.KYC_DOCUMENT_VIEW,
    Permission.COMPLIANCE_CASE_READ,
    Permission.COMPLIANCE_CASE_DECIDE,
    Permission.FRAUD_CASE_READ,
    Permission.TICKET_READ,
    Permission.AUDIT_READ,
  ],

  RISK: [
    Permission.USER_READ,
    Permission.USER_SUSPEND,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_FREEZE,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.FRAUD_CASE_READ,
    Permission.FRAUD_CASE_DECIDE,
    Permission.RISK_RULES_UPDATE,
    Permission.COMPLIANCE_CASE_READ,
    Permission.AUDIT_READ,
  ],

  // The largest, most targeted and least individually vetted population with
  // system access. Deliberately given no power over money or documents.
  SUPPORT: [
    Permission.USER_READ,
    Permission.ACCOUNT_READ,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.FRAUD_CASE_READ,
    Permission.TICKET_READ,
    Permission.TICKET_RESPOND,
  ],

  OPERATIONS: [
    Permission.USER_READ,
    Permission.ACCOUNT_READ,
    Permission.LEDGER_READ,
    Permission.RECONCILIATION_RUN,
    Permission.SETTLEMENT_MANAGE,
    Permission.TICKET_READ,
    Permission.AUDIT_READ,
  ],

  // The only role that may post an adjustment or a reversal, and only ever
  // with a stated reason and a named operator.
  FINANCE: [
    Permission.USER_READ,
    Permission.ACCOUNT_READ,
    Permission.LEDGER_READ,
    Permission.LEDGER_ADJUST,
    Permission.LEDGER_REVERSE,
    Permission.RECONCILIATION_RUN,
    Permission.AUDIT_READ,
  ],

  // Read-only across everything, so an audit can be performed without granting
  // the ability to change anything.
  AUDITOR: [
    Permission.USER_READ,
    Permission.ACCOUNT_READ,
    Permission.LEDGER_READ,
    Permission.KYC_READ,
    Permission.COMPLIANCE_CASE_READ,
    Permission.FRAUD_CASE_READ,
    Permission.TICKET_READ,
    Permission.ADMIN_USER_READ,
    Permission.AUDIT_READ,
  ],
};

export function permissionsFor(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: AdminRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError('Your role does not permit this action', {
      role,
      permission,
    });
  }
}

/** Every permission any role holds — used by the invariant tests. */
export function allGrantedPermissions(): Set<string> {
  const all = new Set<string>();
  for (const permissions of Object.values(ROLE_PERMISSIONS)) {
    for (const permission of permissions) all.add(permission);
  }
  return all;
}

// ── actions requiring more than a permission ────────────────────────────────

export interface PrivilegedActionContext {
  readonly role: AdminRole;
  readonly operatorId: string;
  readonly reason: string;
  readonly mfaSatisfied: boolean;
}

/**
 * Guard for the two actions that actually move money.
 *
 * A permission alone is not enough: an adjustment needs a named operator, a
 * written reason, and a satisfied second factor. Each of the three is what
 * makes the action reviewable afterwards, which is the real control — the
 * audit trail is what deters an insider, not the permission check.
 */
export function assertPrivilegedLedgerAction(
  context: PrivilegedActionContext,
  permission: typeof Permission.LEDGER_ADJUST | typeof Permission.LEDGER_REVERSE,
): void {
  assertPermission(context.role, permission);

  if (!context.mfaSatisfied) {
    throw new ForbiddenError('This action requires multi-factor authentication', {
      permission,
    });
  }
  if (context.operatorId.trim() === '') {
    throw new ForbiddenError('This action requires a named operator', { permission });
  }
  if (context.reason.trim().length < 10) {
    // A one-word reason is not a reason. "fix" tells a future auditor nothing.
    throw new ForbiddenError(
      'This action requires a written reason of at least 10 characters',
      {
        permission,
      },
    );
  }
}
