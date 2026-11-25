/** Mirror of roles.permissions in the database (the database remains the source of truth). */
export const PERMISSIONS = [
  'content.read_all',
  'content.create',
  'content.edit_any',
  'content.publish',
  'content.delete',
  'media.upload',
  'media.delete',
  'inbox.manage',
  'subscribers.manage',
  'analytics.read',
  'users.manage',
  'settings.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleKey = 'owner' | 'admin' | 'editor' | 'writer';

export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: 'المالك',
  admin: 'المدير',
  editor: 'المحرر',
  writer: 'الكاتب',
};

export const ROLE_RANK: Record<RoleKey, number> = { owner: 100, admin: 80, editor: 60, writer: 40 };

export const STATUS_LABELS = {
  draft: 'مسودة',
  review: 'بانتظار المراجعة',
  scheduled: 'مجدول',
  published: 'منشور',
  archived: 'مؤرشف',
} as const;

/** Roles a staff member may assign: owners assign any role, others only roles below their own. */
export function assignableRoles(actor: RoleKey): RoleKey[] {
  if (actor === 'owner') return ['owner', 'admin', 'editor', 'writer'];
  return (Object.keys(ROLE_RANK) as RoleKey[]).filter((r) => ROLE_RANK[r] < ROLE_RANK[actor]);
}
