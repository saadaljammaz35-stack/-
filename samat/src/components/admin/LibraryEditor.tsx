'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { ImageInput } from './ImageInput';

type Row = Record<string, unknown> & { id?: string; name_ar: string; name_en: string; slug: string };
const sar = (h: unknown) => (typeof h === 'number' ? (h / 100).toFixed(2) : '');

/** Ingredient & sauce library editor (names, layer images, prices, stock link, availability). */
export function LibraryEditor({ entity, rows, inventory }: { entity: 'ingredients' | 'sauces'; rows: Row[]; inventory: { id: string; name_ar: string; name_en: string }[] }) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [edit, setEdit] = useState<Row | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const blank: Row = entity === 'ingredients'
    ? { slug: '', name_ar: '', name_en: '', kind: 'vegetable', builder: 'burger', image_url: '', image_top_url: '', thumb_url: '', layer_height: 0.07, extra_price: 0, is_active: true, inventory_id: null, inventory_qty: 1, sort_order: 100 }
    : { slug: '', name_ar: '', name_en: '', color: '#e6dcc8', image_url: '', layer_url: '', top_layer_url: '', price: 0, is_active: true, inventory_id: null, inventory_qty: 1, sort_order: 100 };

  const save = async () => {
    if (!edit) return;
    const row = { ...edit, layer_height: edit.layer_height !== undefined ? Number(edit.layer_height) : undefined, inventory_qty: Number(edit.inventory_qty ?? 1), sort_order: Number(edit.sort_order ?? 0) };
    for (const k of ['created_at', 'updated_at']) delete (row as Record<string, unknown>)[k];
    const res = await fetch(`/api/admin/menu/${entity}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row }) });
    const json = await res.json();
    if (!res.ok) return setMsg(`${t.errors[json.error as keyof typeof t.errors] ?? a.common.error} ${json.detail?.issues?.join(', ') ?? json.detail?.field ?? ''}`);
    setMsg(a.menu.saved);
    setEdit(null);
    router.refresh();
  };
  const remove = async (id: string) => {
    if (!confirm(a.menu.deleteConfirm)) return;
    const res = await fetch(`/api/admin/menu/${entity}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    if (!res.ok) setMsg(a.common.error);
    router.refresh();
  };
  const field = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <label className="text-sm"><span className="label">{label}</span>
      <input className="field" value={String(edit?.[k] ?? '')} onChange={(e) => setEdit((x) => ({ ...x!, [k]: e.target.value }))} {...props} /></label>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button type="button" className="btn btn-primary" onClick={() => setEdit(blank)}><Plus className="size-4" /> {entity === 'ingredients' ? a.menu.newIngredient : a.menu.newSauce}</button></div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {edit && (
        <div className="paper grid gap-3 rounded-3xl p-5 sm:grid-cols-2" data-testid="library-form">
          {field('name_ar', a.menu.nameAr)}
          {field('name_en', a.menu.nameEn, { dir: 'ltr' })}
          {field('slug', a.menu.slug, { dir: 'ltr' })}
          {entity === 'ingredients' ? (
            <>
              <label className="text-sm"><span className="label">{a.menu.kind}</span>
                <select className="field" value={String(edit.kind)} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {Object.entries(a.menu.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label className="text-sm"><span className="label">{a.menu.usedIn}</span>
                <select className="field" value={String(edit.builder)} onChange={(e) => setEdit({ ...edit, builder: e.target.value })}>
                  {Object.entries(a.menu.view).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label className="text-sm"><span className="label">{a.menu.extraPrice} (SAR)</span>
                <input className="field num" dir="ltr" defaultValue={sar(edit.extra_price)} onBlur={(e) => setEdit({ ...edit, extra_price: Math.round(Number(e.target.value || 0) * 100) })} /></label>
              <label className="text-sm"><span className="label">{a.menu.thickness} (0.01–0.9)</span>
                <input type="number" step="0.005" className="field" value={Number(edit.layer_height)} onChange={(e) => setEdit({ ...edit, layer_height: e.target.value })} /></label>
              <ImageInput name="image_url" label={a.menu.layerImage} defaultValue={String(edit.image_url ?? '')} folder="layers" checker onChange={(v) => setEdit((x) => ({ ...x!, image_url: v }))} />
              <ImageInput name="thumb_url" label={a.menu.thumb} defaultValue={String(edit.thumb_url ?? '')} folder="thumbs" checker onChange={(v) => setEdit((x) => ({ ...x!, thumb_url: v }))} />
              {edit.kind === 'bread' && <ImageInput name="image_top_url" label={a.menu.topImage} defaultValue={String(edit.image_top_url ?? '')} folder="layers" checker onChange={(v) => setEdit((x) => ({ ...x!, image_top_url: v }))} />}
            </>
          ) : (
            <>
              <label className="text-sm"><span className="label">{a.menu.color}</span>
                <input type="color" className="field h-12 p-1" value={String(edit.color ?? '#cccccc')} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></label>
              <label className="text-sm"><span className="label">{a.menu.saucePrice} (SAR)</span>
                <input className="field num" dir="ltr" defaultValue={sar(edit.price)} onBlur={(e) => setEdit({ ...edit, price: Math.round(Number(e.target.value || 0) * 100) })} /></label>
              <ImageInput name="image_url" label={a.menu.thumb} defaultValue={String(edit.image_url ?? '')} folder="sauces" checker onChange={(v) => setEdit((x) => ({ ...x!, image_url: v }))} />
              <ImageInput name="layer_url" label={a.menu.sauceLayer} defaultValue={String(edit.layer_url ?? '')} folder="layers" checker onChange={(v) => setEdit((x) => ({ ...x!, layer_url: v }))} />
              <ImageInput name="top_layer_url" label={a.menu.sauceTop} defaultValue={String(edit.top_layer_url ?? '')} folder="layers" checker onChange={(v) => setEdit((x) => ({ ...x!, top_layer_url: v }))} />
            </>
          )}
          <label className="text-sm"><span className="label">{a.menu.stock}</span>
            <select className="field" value={String(edit.inventory_id ?? '')} onChange={(e) => setEdit({ ...edit, inventory_id: e.target.value || null })}>
              <option value="">{a.menu.none}</option>
              {inventory.map((i) => <option key={i.id} value={i.id}>{n(i)}</option>)}
            </select></label>
          {field('inventory_qty', a.menu.stockQty, { type: 'number', step: '0.001', min: 0.001 })}
          {field('sort_order', a.menu.sort, { type: 'number' })}
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5" checked={Boolean(edit.is_active)} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> {a.menu.available}</label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="btn btn-primary" onClick={save} data-testid="library-save"><Save className="size-4" /> {a.common.save}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>{a.common.cancel}</button>
          </div>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className={`glass flex items-center gap-3 rounded-3xl p-3 ${r.is_active ? '' : 'opacity-50'}`} data-testid={`lib-${r.slug}`}>
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sand-300/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(r.thumb_url || r.image_url) ? <img src={String(r.thumb_url || r.image_url)} alt="" className="max-h-12 max-w-12 object-contain" /> : <span className="size-8 rounded-full" style={{ background: String(r.color ?? '#ccc') }} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{n(r)}</p>
              <p className="num text-xs text-espresso-500">{entity === 'ingredients' ? `${a.menu.kinds[r.kind as keyof typeof a.menu.kinds]} · ${a.menu.view[r.builder as keyof typeof a.menu.view]} · +${sar(r.extra_price)}` : `+${sar(r.price)}`}</p>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit(r)}>{a.common.edit}</button>
            <button type="button" className="p-1 text-danger-500" onClick={() => remove(String(r.id))} aria-label={a.common.delete}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
