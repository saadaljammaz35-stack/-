import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-espresso-900 px-5 text-center text-cream-100">
      <div className="max-w-sm">
        <div className="mb-8 flex justify-center"><Logo variant="full" height={110} /></div>
        <h1 className="text-2xl font-bold">الصفحة مو موجودة</h1>
        <p className="mt-4 text-sm text-cream-200/60" dir="ltr" lang="en">This page does not exist.</p>
        <Link href="/" className="btn btn-lg btn-cream mt-8 inline-flex">الرئيسية · Home</Link>
      </div>
    </main>
  );
}
