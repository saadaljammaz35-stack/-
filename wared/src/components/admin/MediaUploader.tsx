'use client';

import { useRef, useState } from 'react';
import { createUpload, finalizeUpload } from '@/lib/admin/actions/media';
import { publicEnv } from '@/lib/env';

export type MediaKind = 'image' | 'audio' | 'video';
export interface MediaOption {
  id: string;
  label: string;
  url: string;
  kind: MediaKind;
}

const BUCKET: Record<MediaKind, 'images' | 'audio' | 'video'> = { image: 'images', audio: 'audio', video: 'video' };
const ACCEPT: Record<MediaKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  audio: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,.mp3,.m4a',
  video: 'video/mp4,video/webm,video/quicktime',
};

function normalizeMime(file: File): string {
  if (file.type) return file.type === 'audio/mp3' ? 'audio/mpeg' : file.type === 'audio/m4a' ? 'audio/mp4' : file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : '';
}

async function readMetadata(file: File, kind: MediaKind): Promise<{ width: number | null; height: number | null; durationSeconds: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight, durationSeconds: null };
    }
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    el.src = url;
    await new Promise<void>((resolve) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => resolve();
      setTimeout(resolve, 8000);
    });
    const video = el as HTMLVideoElement;
    return {
      width: kind === 'video' && video.videoWidth ? video.videoWidth : null,
      height: kind === 'video' && video.videoHeight ? video.videoHeight : null,
      durationSeconds: Number.isFinite(el.duration) ? Math.round(el.duration) : null,
    };
  } catch {
    return { width: null, height: null, durationSeconds: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function putWithProgress(url: string, file: File, mime: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    if (publicEnv.supabasePublishableKey) xhr.setRequestHeader('apikey', publicEnv.supabasePublishableKey);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}

/**
 * Uploads straight from the browser to Supabase Storage through a signed URL issued by the server, so large
 * audio files never pass through (or hit the body limits of) the Next.js server.
 */
export function MediaUploader({ kind, onUploaded, label = 'رفع ملف جديد' }: { kind: MediaKind; onUploaded: (asset: MediaOption) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    const mime = normalizeMime(file);
    const ticket = await createUpload({ bucket: BUCKET[kind], fileName: file.name, mimeType: mime, size: file.size });
    if (!ticket.ok) return setError(ticket.error);
    if (!publicEnv.supabaseUrl) return setError('Supabase غير مهيأ.');
    try {
      setProgress(0);
      const meta = await readMetadata(file, kind);
      const signedUrl = `${publicEnv.supabaseUrl}/storage/v1/object/upload/sign/${ticket.bucket}/${ticket.path}?token=${encodeURIComponent(ticket.token)}`;
      await putWithProgress(signedUrl, file, mime, setProgress);
      const result = await finalizeUpload({
        bucket: ticket.bucket,
        path: ticket.path,
        mimeType: mime,
        size: file.size,
        originalName: file.name,
        ...meta,
        alt: null,
      });
      if (!result.ok || !result.asset) return setError(result.ok ? 'تعذّر تسجيل الملف.' : result.error);
      onUploaded({ id: result.asset.id, label: result.asset.label, url: result.asset.url, kind });
    } catch {
      setError('انقطع الرفع. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        id={`upload-${kind}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
        disabled={progress !== null}
      />
      <label htmlFor={`upload-${kind}`} className={`btn btn-ghost min-h-10 cursor-pointer px-4 text-sm ${progress !== null ? 'pointer-events-none opacity-60' : ''}`}>
        {progress !== null ? `جارٍ الرفع… ${progress}%` : label}
      </label>
      {progress !== null && (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم الرفع">
          <div className="h-full bg-fg transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#b3261e] dark:text-[#ff8a80]">
          {error}
        </p>
      )}
    </div>
  );
}
