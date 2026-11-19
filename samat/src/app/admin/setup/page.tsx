import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SetupForm } from './SetupForm';

export const metadata: Metadata = { title: 'Staff', robots: { index: false }, referrer: 'no-referrer' };

export default function StaffSetup() {
  return <Suspense><SetupForm /></Suspense>;
}
