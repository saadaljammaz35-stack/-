import type { Metadata } from 'next';
import { PickupScreen } from './PickupScreen';

export const metadata: Metadata = { title: 'Pickup', robots: { index: false } };

export default function Page() {
  return <PickupScreen />;
}
