'use client';

import { useActionState } from 'react';
import { updateAccount } from '@/lib/admin/actions/manage';

export function AccountForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(updateAccount, null);
  return (
    <form action={action} className="grid max-w-md gap-6">
      <label className="block">
        <span className="text-sm text-muted">الاسم</span>
        <input name="full_name" defaultValue={fullName} required maxLength={120} className="field" autoComplete="name" />
      </label>
      <label className="block">
        <span className="text-sm text-muted">كلمة مرور جديدة (اختياري، 12 حرفًا على الأقل)</span>
        <input name="password" type="password" minLength={12} autoComplete="new-password" dir="ltr" className="field" />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        {state && (
          <span role="status" className="text-sm text-muted">
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
    </form>
  );
}
