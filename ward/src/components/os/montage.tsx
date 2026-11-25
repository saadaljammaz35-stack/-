'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { fmtClock } from '@/lib/media/timeline';
import type { EditPlan, Framing, PlanCut, PlanShort } from '@/lib/media/plan';

type L = 'ar' | 'en';
const t = (l: L, ar: string, en: string) => (l === 'ar' ? ar : en);

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { ok: res.ok, data };
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('network_error'));
    xhr.send(file);
  });
}

// ─────────────────────────── upload ───────────────────────────

export function MontageUpload({ episodeId, locale }: { episodeId: string; locale: L }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'whisper' | 'upload' | 'none'>('whisper');
  const [transcript, setTranscript] = useState<File | null>(null);
  const [preset, setPreset] = useState<'light' | 'normal' | 'tight'>('normal');
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = pct !== null;

  async function start() {
    if (!file) return;
    setError(null);
    setPct(0);
    try {
      const intent = await postJson(`/api/os/episodes/${episodeId}/montage`, { action: 'intent', name: file.name, size: file.size, type: file.type });
      if (!intent.ok) throw new Error(String(intent.data.message ?? intent.data.error ?? 'error'));
      const key = String(intent.data.key);
      if (intent.data.storage === 'vercel-blob') {
        const { upload } = await import('@vercel/blob/client');
        await upload(key, file, {
          access: 'private',
          handleUploadUrl: String(intent.data.handleUploadUrl),
          multipart: file.size > 64 * 1024 * 1024,
          contentType: file.type || 'video/mp4',
          onUploadProgress: (e) => setPct(e.percentage),
        });
      } else {
        await putWithProgress(String(intent.data.uploadUrl), file, setPct);
      }
      setPct(100);
      const created = await postJson(`/api/os/episodes/${episodeId}/montage`, {
        action: 'create',
        key,
        name: file.name,
        mime: file.type || 'video/mp4',
        size: file.size,
        transcript_source: source,
        transcript_text: source === 'upload' && transcript ? await transcript.text() : undefined,
        transcript_name: transcript?.name,
        preset,
      });
      if (!created.ok) throw new Error(String(created.data.message ?? created.data.error ?? 'error'));
      router.push(String(created.data.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPct(null);
    }
  }

  return (
    <div className="stack">
      <label className="field">
        {t(locale, 'ملف الحلقة (فيديو أو صوت)', 'Episode file (video or audio)')}
        <input className="input" type="file" accept="video/*,audio/*,.mp4,.mov,.m4v,.mkv,.webm,.mp3,.m4a,.wav" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy}>
        <div className="small muted">{t(locale, 'التفريغ النصي (يحدد جودة الفصول والمقاطع القصيرة والترجمة)', 'Transcript (drives chapters, shorts and captions)')}</div>
        <label className="row small"><input type="radio" name="tsrc" checked={source === 'whisper'} onChange={() => setSource('whisper')} />{t(locale, 'تفريغ تلقائي بـ Whisper — مجاني، يأخذ وقتًا أطول', 'Automatic with Whisper — free, takes longer')}</label>
        <label className="row small"><input type="radio" name="tsrc" checked={source === 'upload'} onChange={() => setSource('upload')} />{t(locale, 'عندي ملف ترجمة جاهز (SRT / VTT)', 'I have a subtitle file (SRT / VTT)')}</label>
        {source === 'upload' && <input className="input" type="file" accept=".srt,.vtt,.json,text/vtt,application/x-subrip" onChange={(e) => setTranscript(e.target.files?.[0] ?? null)} />}
        <label className="row small"><input type="radio" name="tsrc" checked={source === 'none'} onChange={() => setSource('none')} />{t(locale, 'بدون تفريغ — قص الصمت فقط', 'No transcript — cut silences only')}</label>
        <label className="field">
          {t(locale, 'شدة القص', 'Cut strength')}
          <select className="select" value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
            <option value="light">{t(locale, 'خفيف — يحذف الصمت الطويل فقط (1.2 ث+)', 'Light — long pauses only (1.2s+)')}</option>
            <option value="normal">{t(locale, 'متوسط — مناسب للبودكاست (0.75 ث+)', 'Normal — podcast pace (0.75s+)')}</option>
            <option value="tight">{t(locale, 'مشدود — إيقاع سريع (0.5 ث+)', 'Tight — fast pace (0.5s+)')}</option>
          </select>
        </label>
      </fieldset>
      {pct !== null && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="meter"><span style={{ width: `${pct.toFixed(1)}%` }} /></div>
          <div className="small faint">{pct < 100 ? `${t(locale, 'رفع الملف', 'Uploading')} ${pct.toFixed(0)}%` : t(locale, 'بدء التحليل…', 'Starting analysis…')}</div>
        </div>
      )}
      {error && <div className="notice bad">{error}</div>}
      <div>
        <button className="btn btn-primary" disabled={!file || busy || (source === 'upload' && !transcript)} onClick={start}>
          {t(locale, 'ابدأ المونتاج الآلي', 'Start automatic edit')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── review ───────────────────────────

const KIND_LABEL: Record<PlanCut['kind'], [string, string]> = {
  dead: ['صمت', 'Silence'],
  filler: ['تأتأة', 'Filler'],
  repeat: ['إعادة', 'Retake'],
  content: ['اقتراح الوكيل', 'Agent suggestion'],
  manual: ['يدوي', 'Manual'],
};

const FRAMING_LABEL: Record<Framing, [string, string]> = {
  fit: ['كامل الصورة مع خلفية', 'Whole frame on blur'],
  center: ['قص في المنتصف', 'Crop center'],
  left: ['قص يسار', 'Crop left'],
  right: ['قص يمين', 'Crop right'],
};

function keeps(duration: number, cuts: PlanCut[]): [number, number][] {
  const s = cuts.filter((c) => c.enabled).map((c) => [Math.max(0, c.start), Math.min(duration, c.end)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of s) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 0.04) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const out: [number, number][] = [];
  let tt = 0;
  for (const [a, b] of merged) {
    if (a - tt >= 0.25) out.push([tt, a]);
    tt = Math.max(tt, b);
  }
  if (duration - tt >= 0.25) out.push([tt, duration]);
  return out;
}

export function MontageReview({ projectId, plan, sourceUrl, sourceIsAudio, canWrite, locale }: { projectId: string; plan: EditPlan; sourceUrl: string; sourceIsAudio: boolean; canWrite: boolean; locale: L }) {
  const router = useRouter();
  const video = useRef<HTMLMediaElement | null>(null);
  const bind = (el: HTMLMediaElement | null) => {
    video.current = el;
  };
  const [cuts, setCuts] = useState<PlanCut[]>(plan.cuts);
  const [shorts, setShorts] = useState<PlanShort[]>(plan.shorts);
  const [chapters, setChapters] = useState(plan.chapters.map((c) => `${fmtClock(c.start)} ${c.title}`).join('\n'));
  const [filter, setFilter] = useState<'all' | PlanCut['kind']>('all');
  const [mark, setMark] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [skipCuts, setSkipCuts] = useState(true);

  const kept = useMemo(() => keeps(plan.duration, cuts), [plan.duration, cuts]);
  const outLen = kept.reduce((n, [a, b]) => n + b - a, 0);
  const shown = cuts.filter((c) => filter === 'all' || c.kind === filter);

  const seek = (s: number, play = true) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, s);
    if (play) void v.play();
  };

  // Preview the edit: while playing, jump over every enabled cut.
  const onTime = () => {
    const v = video.current;
    if (!v || !skipCuts || v.paused) return;
    const now = v.currentTime;
    const c = cuts.find((x) => x.enabled && now >= x.start && now < x.end - 0.05);
    if (c) v.currentTime = c.end;
  };

  const patchCut = (id: string, enabled: boolean) => {
    setCuts((cs) => cs.map((c) => (c.id === id ? { ...c, enabled } : c)));
    setDirty(true);
  };
  const setAll = (enabled: boolean) => {
    setCuts((cs) => cs.map((c) => (filter === 'all' || c.kind === filter ? { ...c, enabled } : c)));
    setDirty(true);
  };
  const patchShort = (id: string, p: Partial<PlanShort>) => {
    setShorts((ss) => ss.map((s) => (s.id === id ? { ...s, ...p } : s)));
    setDirty(true);
  };

  async function save(extra: Record<string, unknown> = {}): Promise<boolean> {
    const res = await postJson(`/api/os/montage/${projectId}`, {
      action: 'save',
      cuts: cuts.map((c) => ({ id: c.id, enabled: c.enabled })),
      chapters,
      shorts: shorts.map((s) => ({ id: s.id, enabled: s.enabled, title: s.title, hook: s.hook, framing: s.framing, captions: s.captions, start: s.start, end: s.end })),
      ...extra,
    });
    if (!res.ok) {
      setMsg(String(res.data.message ?? res.data.error ?? 'error'));
      return false;
    }
    const next = res.data.plan as EditPlan | undefined;
    if (next) {
      setCuts(next.cuts);
      setShorts(next.shorts);
    }
    setDirty(false);
    setMsg(t(locale, 'تم الحفظ', 'Saved'));
    return true;
  }

  function addManual(end: number) {
    if (mark === null) return;
    const [a, b] = mark < end ? [mark, end] : [end, mark];
    setMark(null);
    startTransition(async () => {
      await save({ manual_cut: { start: a, end: b, reason: '' } });
    });
  }

  function render() {
    if (!confirm(t(locale, 'إخراج الحلقة والمقاطع القصيرة بهذه الخطة؟ قد يستغرق ذلك عدة دقائق.', 'Render the episode and shorts with this plan? This can take several minutes.'))) return;
    startTransition(async () => {
      if (dirty && !(await save())) return;
      const res = await postJson(`/api/os/montage/${projectId}`, { action: 'render' });
      if (!res.ok) setMsg(String(res.data.message ?? res.data.error ?? 'error'));
      router.refresh();
    });
  }

  const enabledShorts = shorts.filter((s) => s.enabled).length;

  return (
    <div className="stack">
      <div className="card montage-player">
        {sourceIsAudio ? (
          <audio ref={bind} src={sourceUrl} controls preload="metadata" onTimeUpdate={onTime} style={{ width: '100%' }} />
        ) : (
          <video ref={bind} src={sourceUrl} controls preload="metadata" playsInline onTimeUpdate={onTime} />
        )}
        <div className="spread small" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <label className="row"><input type="checkbox" checked={skipCuts} onChange={(e) => setSkipCuts(e.target.checked)} />{t(locale, 'معاينة بعد القص (تخطّي المقاطع المحذوفة)', 'Preview the edit (skip cut parts)')}</label>
          <span className="faint ltr">{fmtClock(plan.duration)} → <strong>{fmtClock(outLen)}</strong> (−{fmtClock(plan.duration - outLen)})</span>
        </div>
        {canWrite && (
          <div className="row small" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {mark === null ? (
              <button className="btn btn-sm" onClick={() => setMark(video.current?.currentTime ?? 0)}>{t(locale, 'بداية قص يدوي من هنا', 'Mark manual cut start')}</button>
            ) : (
              <>
                <span className="badge warn ltr">{fmtClock(mark, true)} →</span>
                <button className="btn btn-sm btn-sand" disabled={pending} onClick={() => addManual(video.current?.currentTime ?? 0)}>{t(locale, 'نهاية القص هنا', 'Mark cut end here')}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setMark(null)}>✕</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>{t(locale, 'القصّات', 'Cuts')} <span className="faint small">({cuts.filter((c) => c.enabled).length}/{cuts.length})</span></div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <select className="select" style={{ minHeight: 32, width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">{t(locale, 'الكل', 'All')}</option>
              {(Object.keys(KIND_LABEL) as PlanCut['kind'][]).map((k) => <option key={k} value={k}>{t(locale, ...KIND_LABEL[k])} ({cuts.filter((c) => c.kind === k).length})</option>)}
            </select>
            {canWrite && <><button className="btn btn-sm btn-ghost" onClick={() => setAll(true)}>{t(locale, 'تفعيل', 'Enable')}</button><button className="btn btn-sm btn-ghost" onClick={() => setAll(false)}>{t(locale, 'تعطيل', 'Disable')}</button></>}
          </div>
        </div>
        <div className="montage-cuts">
          {shown.length === 0 && <div className="empty">—</div>}
          {shown.map((c) => (
            <div key={c.id} className={`montage-cut${c.enabled ? '' : ' off'}`}>
              <input type="checkbox" checked={c.enabled} disabled={!canWrite} onChange={(e) => patchCut(c.id, e.target.checked)} aria-label="cut" />
              <button className="btn btn-sm btn-ghost ltr mono" onClick={() => seek(Math.max(0, c.start - 2))}>{fmtClock(c.start, true)}</button>
              <span className={`badge ${c.kind === 'content' ? 'warn' : 'plain'}`}>{t(locale, ...KIND_LABEL[c.kind])}</span>
              <span className="small faint ltr">{(c.end - c.start).toFixed(1)}s</span>
              <span className="small montage-reason">{c.reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t(locale, 'المقاطع القصيرة', 'Shorts')} <span className="faint small">({enabledShorts})</span></div>
        {shorts.length === 0 && <div className="empty">{t(locale, 'لا توجد مقاطع مقترحة (تحتاج تفريغًا نصيًا).', 'No suggestions (needs a transcript).')}</div>}
        <div className="montage-shorts">
          {shorts.map((s) => (
            <div key={s.id} className={`montage-short${s.enabled ? '' : ' off'}`}>
              <div className="spread">
                <label className="row small"><input type="checkbox" checked={s.enabled} disabled={!canWrite} onChange={(e) => patchShort(s.id, { enabled: e.target.checked })} />{t(locale, 'إخراج', 'Render')}</label>
                <span className="badge plain ltr">{s.score}/10 · {fmtClock(s.end - s.start)}</span>
              </div>
              <input className="input" value={s.title} disabled={!canWrite} onChange={(e) => patchShort(s.id, { title: e.target.value })} placeholder={t(locale, 'العنوان', 'Title')} />
              <input className="input" value={s.hook} disabled={!canWrite} maxLength={60} onChange={(e) => patchShort(s.id, { hook: e.target.value })} placeholder={t(locale, 'نص أول ثانيتين', 'Opening on-screen text')} />
              <div className="row" dir="ltr" style={{ flexWrap: 'wrap' }}>
                <input className="input ltr" style={{ width: 96 }} type="number" step="0.1" min={0} value={s.start} disabled={!canWrite} onChange={(e) => patchShort(s.id, { start: Number(e.target.value) })} />
                <span className="faint">→</span>
                <input className="input ltr" style={{ width: 96 }} type="number" step="0.1" min={0} value={s.end} disabled={!canWrite} onChange={(e) => patchShort(s.id, { end: Number(e.target.value) })} />
                <button className="btn btn-sm" onClick={() => seek(s.start)}>▶︎</button>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <select className="select" style={{ minHeight: 32, flex: 1 }} value={s.framing} disabled={!canWrite} onChange={(e) => patchShort(s.id, { framing: e.target.value as Framing })}>
                  {(Object.keys(FRAMING_LABEL) as Framing[]).map((f) => <option key={f} value={f}>{t(locale, ...FRAMING_LABEL[f])}</option>)}
                </select>
                <label className="row small"><input type="checkbox" checked={s.captions} disabled={!canWrite} onChange={(e) => patchShort(s.id, { captions: e.target.checked })} />{t(locale, 'ترجمة', 'Captions')}</label>
              </div>
              {s.reason && <div className="small faint">{s.reason}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t(locale, 'فصول يوتيوب (توقيت التسجيل الأصلي)', 'YouTube chapters (source timeline)')}</div>
        <textarea className="textarea" value={chapters} disabled={!canWrite} onChange={(e) => { setChapters(e.target.value); setDirty(true); }} style={{ minHeight: 160 }} placeholder="0:00 المقدمة" />
        <div className="small faint" style={{ marginTop: 6 }}>{t(locale, 'سطر لكل فصل: m:ss العنوان. تُحوَّل تلقائيًا لتوقيت النسخة بعد القص عند التصدير.', 'One per line: m:ss Title. Converted to the edited timeline on export.')}</div>
      </div>

      {canWrite && (
        <div className="row montage-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn" disabled={pending || !dirty} onClick={() => startTransition(async () => { await save(); })}>{t(locale, 'حفظ التعديلات', 'Save changes')}</button>
          <button className="btn btn-primary" disabled={pending} onClick={render}>{t(locale, `إخراج الحلقة + ${enabledShorts} مقطع قصير`, `Render episode + ${enabledShorts} shorts`)}</button>
          {msg && <span className="small faint">{msg}</span>}
        </div>
      )}
    </div>
  );
}
