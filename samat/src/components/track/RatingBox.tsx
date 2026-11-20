'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

/** Stars + optional comment after pickup; one rating per order. */
export function RatingBox({ token, initial }: { token: string; initial: number | null }) {
  const { t } = useI18n();
  const [stars, setStars] = useState(initial ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(initial !== null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!stars) return;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/track/${token}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: stars, comment: comment.trim() || undefined }) });
    setBusy(false);
    if (res.ok || res.status === 409) return setDone(true);
    setErr(t.common.error);
  };

  return (
    <section className="glass mt-5 rounded-[2rem] p-6 text-center" data-testid="rating-box">
      <h2 className="font-bold">{done ? t.track.rateThanks : t.track.rateTitle}</h2>
      <div className="mt-3 flex justify-center gap-1" role="radiogroup" aria-label={t.track.rateTitle}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n}`} disabled={done}
            className="p-1 transition-transform active:scale-90 disabled:cursor-default" onMouseEnter={() => !done && setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)} data-testid={`star-${n}`}>
            <Star className={`size-9 ${(hover || stars) >= n ? 'fill-gold-400 text-gold-400' : 'text-sand-300'}`} />
          </button>
        ))}
      </div>
      {!done && stars > 0 && (
        <div className="mt-3 space-y-3">
          <textarea className="field min-h-20" maxLength={500} placeholder={t.track.rateComment} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={send} data-testid="rating-send">{busy ? t.common.loading : t.track.rateSend}</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-danger-500">{err}</p>}
    </section>
  );
}
