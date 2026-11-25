import type { MemberRole, OrgContext } from '@/lib/db';

/**
 * Server-side permission matrix. The founder is the organization `owner`.
 * Agents never receive a role from this table: what they can do is limited to their
 * tool allowlist, and anything sensitive becomes an approval request (see approvals.ts).
 */
export const PERMISSIONS = {
  read: ['owner', 'admin', 'editor', 'viewer'],
  'content.write': ['owner', 'admin', 'editor'],
  'agents.run': ['owner', 'admin', 'editor'],
  'agents.configure': ['owner', 'admin'],
  'sponsors.write': ['owner', 'admin'],
  'finance.write': ['owner', 'admin'],
  'knowledge.delete': ['owner', 'admin'],
  'audit.read': ['owner', 'admin'],
  'kill_switch': ['owner', 'admin'],
  // Founder-only decisions.
  'approvals.decide': ['owner'],
  'episodes.confirm_guest': ['owner'],
  'episodes.publish': ['owner'],
  'settings.write': ['owner'],
  'members.manage': ['owner'],
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: OrgContext['role'], permission: Permission): boolean {
  if (role === 'system') return true;
  if (role === 'agent') return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
