import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Staff', robots: { index: false } };

export default function AdminLogin() {
  return <Suspense><LoginForm /></Suspense>;
}
