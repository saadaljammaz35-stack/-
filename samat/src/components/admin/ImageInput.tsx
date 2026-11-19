'use client';
import { useRef, useState } from 'react';
import { ImageUp, Loader2, X } from 'lucide-react';

/** Uploads an image and keeps its public URL in a hidden form field. */
export function ImageInput({ name, defaultValue, label, folder = 'menu', bucket = 'menu', checker = false, onChange }: {
  name: string; defaultValue?: string | null; label: string; folder?: string; bucket?: 'menu' | 'assets'; checker?: boolean; onChange?: (url: string) => void;
}) {
  const [url, setUrlState] = useState(defaultValue ?? '');
  const setUrl = (v: string) => { setUrlState(v); onChange?.(v); };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set('file', f); fd.set('folder', folder); fd.set('bucket', bucket);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error);
    setUrl(json.url);
  };
  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div className={`relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-sand-300 ${checker ? 'bg-[conic-gradient(#eee_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:16px_16px]' : 'bg-cream-100'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <ImageUp className="size-6 text-espresso-400" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} Upload</button>
          {url && <button type="button" className="btn btn-sm btn-ghost text-danger-500" onClick={() => setUrl('')}><X className="size-4" /></button>}
          {err && <span className="text-xs text-danger-500">{err}</span>}
        </div>
      </div>
    </div>
  );
}
