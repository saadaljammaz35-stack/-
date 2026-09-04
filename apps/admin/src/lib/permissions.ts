/**
 * Admin session and permission helpers.
 *
 * These gate what the UI *renders*. They are not the security boundary — the
 * API enforces the same table server-side, and the database triggers enforce
 * the absolute denials beneath that. Hiding a button the server would refuse
 * anyway is a usability decision; treating a hidden button as protection is how
 * a plane gets breached by someone who types the URL directly.
 */

import { type AdminRole } from '@nabd/shared';
import { Permission, hasPermission, permissionsFor } from '@nabd/security';

export interface AdminSession {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: AdminRole;
  /** MFA is mandatory on this plane; a session without it can read nothing. */
  readonly mfaSatisfied: boolean;
}

export interface NavItem {
  readonly href: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly permission: Permission;
}

/** Every page in the admin plane, with the permission that reveals it. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/',
    labelEn: 'Overview',
    labelAr: 'نظرة عامة',
    permission: Permission.USER_READ,
  },
  {
    href: '/customers',
    labelEn: 'Customers',
    labelAr: 'العملاء',
    permission: Permission.USER_READ,
  },
  {
    href: '/transactions',
    labelEn: 'Transactions',
    labelAr: 'العمليات',
    permission: Permission.LEDGER_READ,
  },
  {
    href: '/kyc',
    labelEn: 'KYC queue',
    labelAr: 'طابور التوثيق',
    permission: Permission.KYC_READ,
  },
  {
    href: '/fraud',
    labelEn: 'Fraud queue',
    labelAr: 'طابور المخاطر',
    permission: Permission.FRAUD_CASE_READ,
  },
  {
    href: '/compliance',
    labelEn: 'Compliance',
    labelAr: 'الامتثال',
    permission: Permission.COMPLIANCE_CASE_READ,
  },
  {
    href: '/reconciliation',
    labelEn: 'Reconciliation',
    labelAr: 'المطابقة',
    permission: Permission.RECONCILIATION_RUN,
  },
  {
    href: '/support',
    labelEn: 'Support',
    labelAr: 'الدعم',
    permission: Permission.TICKET_READ,
  },
  {
    href: '/audit',
    labelEn: 'Audit log',
    labelAr: 'سجل التدقيق',
    permission: Permission.AUDIT_READ,
  },
];

export function visibleNavItems(session: AdminSession): readonly NavItem[] {
  if (!session.mfaSatisfied) return [];
  return NAV_ITEMS.filter((item) => hasPermission(session.role, item.permission));
}

export function can(session: AdminSession, permission: Permission): boolean {
  // An unsatisfied second factor means no permission at all, not a reduced set.
  return session.mfaSatisfied && hasPermission(session.role, permission);
}

export function describeRole(role: AdminRole): { en: string; ar: string } {
  const names: Record<AdminRole, { en: string; ar: string }> = {
    SUPER_ADMIN: { en: 'Super admin', ar: 'مدير عام' },
    ADMIN: { en: 'Administrator', ar: 'مدير' },
    COMPLIANCE: { en: 'Compliance', ar: 'الامتثال' },
    RISK: { en: 'Risk', ar: 'المخاطر' },
    SUPPORT: { en: 'Support', ar: 'الدعم' },
    OPERATIONS: { en: 'Operations', ar: 'العمليات' },
    FINANCE: { en: 'Finance', ar: 'المالية' },
    AUDITOR: { en: 'Auditor', ar: 'مدقق' },
  };
  return names[role];
}

export { Permission, permissionsFor };
