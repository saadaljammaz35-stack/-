import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';

export default async function Forbidden() {
  const a = adminDicts[await getLocale()];
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-bold text-espresso-300">403</p>
        <p className="mt-3 text-lg">{a.forbidden}</p>
        <Link href="/admin" className="btn btn-primary mt-6">{a.nav.dashboard}</Link>
      </div>
    </div>
  );
}
