'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AdminResult } from '@/lib/validation/admin';

/** Runs a server action from a button, optionally after a confirmation, then refreshes or navigates. */
export function ActionButton({
  action,
  label,
  confirm,
  tone = 'ghost',
  className = '',
}: {
  action: () => Promise<AdminResult>;
  label: string;
  confirm?: string;
  tone?: 'ghost' | 'danger' | 'primary';
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const styles = { ghost: 'btn btn-ghost', primary: 'btn btn-primary', danger: 'btn border border-[#b3261e] text-[#b3261e] hover:bg-[#b3261e] hover:text-white dark:border-[#ff8a80] dark:text-[#ff8a80]' };
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={`${styles[tone]} min-h-10 px-4 text-sm ${className}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const res = await action();
            setMessage(res.ok ? (res.message ?? null) : res.error);
            if (res.ok) {
              if (res.redirectTo) router.push(res.redirectTo);
              else router.refresh();
            }
          });
        }}
      >
        {pending ? '…' : label}
      </button>
      {message && (
        <span role="status" className="text-sm text-muted">
          {message}
        </span>
      )}
    </span>
  );
}
