'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateUser } from '@/lib/admin/actions/manage';

export function UserControls({ id, role, active, roles }: { id: string; role: string | null; active: boolean; roles: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateUser({ id, role: String(data.get('role')), is_active: data.get('active') === 'on' });
          setMessage(res.ok ? (res.message ?? '') : res.error);
          if (res.ok) router.refresh();
        });
      }}
    >
      <label className="sr-only" htmlFor={`role-${id}`}>
        الدور
      </label>
      <select id={`role-${id}`} name="role" defaultValue={role ?? 'none'} className="field w-36 py-2 text-sm">
        <option value="none">بدون صلاحية</option>
        {roles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} className="size-4 accent-current" />
        نشط
      </label>
      <button type="submit" className="btn btn-ghost min-h-10 px-4 text-sm" disabled={pending}>
        حفظ
      </button>
      {message && (
        <span role="status" className="text-sm text-muted">
          {message}
        </span>
      )}
    </form>
  );
}
