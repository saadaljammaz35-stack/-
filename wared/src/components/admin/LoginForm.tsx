'use client';

import { useActionState, useState } from 'react';
import { requestPasswordReset, signIn } from '@/lib/admin/actions/manage';

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [loginState, loginAction, loginPending] = useActionState(signIn, null);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, null);

  if (mode === 'reset') {
    return (
      <form action={resetAction} className="grid gap-6">
        <label className="block">
          <span className="text-sm text-muted">البريد الإلكتروني</span>
          <input name="email" type="email" required autoComplete="email" dir="ltr" className="field" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={resetPending}>
          {resetPending ? 'جارٍ الإرسال…' : 'أرسل رابط إعادة التعيين'}
        </button>
        {resetState && (
          <p role="status" className={resetState.ok ? 'text-fg' : 'text-[#b3261e] dark:text-[#ff8a80]'}>
            {resetState.ok ? resetState.message : resetState.error}
          </p>
        )}
        <button type="button" onClick={() => setMode('login')} className="text-sm text-muted underline">
          الرجوع لتسجيل الدخول
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="grid gap-6">
      <input type="hidden" name="next" value={next ?? ''} />
      <label className="block">
        <span className="text-sm text-muted">البريد الإلكتروني</span>
        <input name="email" type="email" required autoComplete="username" dir="ltr" className="field" />
      </label>
      <label className="block">
        <span className="text-sm text-muted">كلمة المرور</span>
        <input name="password" type="password" required minLength={8} autoComplete="current-password" dir="ltr" className="field" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={loginPending}>
        {loginPending ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
      </button>
      {loginState && !loginState.ok && (
        <p role="alert" className="text-[#b3261e] dark:text-[#ff8a80]">
          {loginState.error}
        </p>
      )}
      <button type="button" onClick={() => setMode('reset')} className="text-sm text-muted underline">
        نسيت كلمة المرور؟
      </button>
    </form>
  );
}
