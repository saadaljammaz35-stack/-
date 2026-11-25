'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateInboxItem } from '@/lib/admin/actions/manage';

export function InboxEditor({
  table,
  id,
  status,
  notes,
  statuses,
}: {
  table: 'contact_messages' | 'sponsorship_requests';
  id: string;
  status: string;
  notes: string;
  statuses: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="grid max-w-xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateInboxItem(table, {
            id,
            status: String(data.get('status')),
            internal_notes: String(data.get('internal_notes') ?? ''),
            assign_to_me: data.get('assign') === 'on',
          });
          setMessage(res.ok ? (res.message ?? '') : res.error);
          if (res.ok) router.refresh();
        });
      }}
    >
      <label className="block">
        <span className="text-sm text-muted">الحالة</span>
        <select name="status" defaultValue={status} className="field">
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-muted">ملاحظات داخلية (لا تظهر للمرسل)</span>
        <textarea name="internal_notes" defaultValue={notes} rows={4} className="field" />
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="assign" className="size-4 accent-current" />
        إسناد لي
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        {message && (
          <span role="status" className="text-sm text-muted">
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
