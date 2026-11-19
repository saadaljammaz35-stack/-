import type { Metadata } from 'next';
import { requireStaffPage } from '@/lib/auth/staff';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s — SAMAT Admin' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  return <AdminShell perms={[...staff.permissions]} email={staff.email} role={staff.role}>{children}</AdminShell>;
}
