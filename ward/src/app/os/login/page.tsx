import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { optionalSession } from '@/lib/auth/page';
import { getPrefs } from '@/lib/prefs';
import { dict } from '@/lib/i18n';
import s from '../os.module.css';

export const metadata: Metadata = { title: 'WARD OS', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await optionalSession()) redirect('/os');
  const { locale } = await getPrefs();
  const t = dict(locale);
  const { error } = await searchParams;
  return (
    <main className={s.login}>
      <form className={`${s.loginCard} fade-in`} action="/api/os/auth/login" method="post">
        <div className={s.loginWord}>{locale === 'ar' ? 'وارد' : 'WARD'}</div>
        <div className={s.loginRule} />
        <h1 style={{ textAlign: 'center', fontSize: 16, fontWeight: 500 }} className="muted">
          {t.login.title}
        </h1>
        {error && (
          <div className="notice bad" role="alert">
            {error === 'limited' ? t.login.limited : t.login.failed}
          </div>
        )}
        <label className="field">
          {t.login.email}
          <input className="input ltr" type="email" name="email" autoComplete="username" required maxLength={200} />
        </label>
        <label className="field">
          {t.login.password}
          <input className="input ltr" type="password" name="password" autoComplete="current-password" required maxLength={200} />
        </label>
        <button className="btn btn-primary" style={{ height: 44 }}>
          {t.login.submit}
        </button>
      </form>
    </main>
  );
}
