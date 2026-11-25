'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteMedia, updateMedia } from '@/lib/admin/actions/media';
import { MediaUploader, type MediaKind } from './MediaUploader';

export interface LibraryItem {
  id: string;
  kind: MediaKind;
  url: string;
  name: string;
  alt: string;
  bytes: number;
  created: string;
}

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}

export function MediaLibrary({ items, canDelete }: { items: LibraryItem[]; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? (res.message ?? null) : (res.error ?? null));
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-6 rounded-2xl border border-line p-5">
        {(['image', 'audio', 'video'] as MediaKind[]).map((kind) => (
          <MediaUploader key={kind} kind={kind} label={{ image: 'رفع صورة', audio: 'رفع ملف صوتي', video: 'رفع فيديو' }[kind]} onUploaded={() => router.refresh()} />
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      {items.length === 0 ? (
        <p className="border-y border-line py-10 text-muted">المكتبة فارغة.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line p-4">
              {item.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                <img src={item.url} alt={item.alt} loading="lazy" className="aspect-video w-full rounded-xl bg-surface object-cover" />
              ) : item.kind === 'audio' ? (
                <audio src={item.url} controls preload="none" className="w-full" />
              ) : (
                <video src={item.url} controls preload="none" className="aspect-video w-full rounded-xl bg-ink" />
              )}
              <p className="mt-3 truncate text-sm font-medium" dir="auto">
                {item.name}
              </p>
              <p className="text-xs text-muted">
                {size(item.bytes)} · {item.created}
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const alt = new FormData(e.currentTarget).get('alt');
                  run(() => updateMedia({ id: item.id, alt: String(alt ?? ''), alt_en: null, credit: null }));
                }}
              >
                <label className="sr-only" htmlFor={`alt-${item.id}`}>
                  النص البديل
                </label>
                <input id={`alt-${item.id}`} name="alt" defaultValue={item.alt} placeholder="وصف الصورة لقارئات الشاشة" className="field py-2 text-sm" />
                <button type="submit" className="btn btn-ghost min-h-10 shrink-0 px-3 text-sm" disabled={pending}>
                  حفظ
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm text-muted underline"
                  onClick={() => {
                    void navigator.clipboard.writeText(item.url);
                    setMessage('نُسخ الرابط');
                  }}
                >
                  نسخ الرابط
                </button>
                {canDelete && (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm text-[#b3261e] underline dark:text-[#ff8a80]"
                    onClick={() => {
                      if (window.confirm('حذف الملف نهائيًا؟ ستفقد الحلقات أو المقالات التي تستخدمه هذا الملف.')) run(() => deleteMedia(item.id));
                    }}
                  >
                    حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
