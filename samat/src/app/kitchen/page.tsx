import type { Metadata } from 'next';
import { requireStaffPage } from '@/lib/auth/staff';
import { KitchenBoard } from '@/components/admin/KitchenBoard';

export const metadata: Metadata = { title: 'Kitchen', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const staff = await requireStaffPage('kitchen.view', '/kitchen');
  return <KitchenBoard canUpdate={staff.permissions.has('kitchen.update')} canDeliver={staff.permissions.has('kitchen.update') || staff.permissions.has('pickup.verify')} />;
}
