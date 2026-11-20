'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import type { Selection } from '@/lib/catalog-types';

/** "Save this build as a favourite" (signed-in customers), e.g. «برغري». */
export function SaveFavorite({ productId, slug, selection, signedIn }: { productId: string; slug: string; selection: Selection; signedIn: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');

  if (!signedIn) {
    return <Link href={`/account?next=/p/${slug}`} className="btn btn-sm btn-ghost"><Heart className="size-4" /> {t.builder.favSignIn}</Link>;
  }
  if (state === 'saved') return <span className="btn btn-sm btn-ghost text-ok-500" data-testid="fav-saved"><Heart className="size-4 fill-current" /> {t.builder.favSaved}</span>;
  if (!open) return <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(true)} data-testid="fav-open"><Heart className="size-4" /> {t.builder.favSave}</button>;

  const save = async () => {
    if (!name.trim()) return;
    setState('busy');
    const res = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      product_id: productId, name: name.trim(),
      item: { bread_id: selection.breadId, ingredients: selection.ingredients, sauces: selection.sauces, options: selection.options ?? [] },
    }) });
    setState(res.ok ? 'saved' : 'error');
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input className="field min-h-10 w-40 py-1.5" maxLength={40} autoFocus placeholder={t.builder.favName} value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} data-testid="fav-name" />
      <button type="button" className="btn btn-sm btn-primary" disabled={state === 'busy' || !name.trim()} onClick={save} data-testid="fav-save"><Heart className="size-4" /> {t.builder.favSaveShort}</button>
      {state === 'error' && <span className="text-xs text-danger-500">{t.common.error}</span>}
    </span>
  );
}
