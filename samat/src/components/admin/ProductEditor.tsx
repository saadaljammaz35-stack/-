'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { ImageInput } from './ImageInput';

type Role = 'base' | 'default' | 'extra' | 'bread_choice';
interface Lib { id: string; name_ar: string; name_en: string; kind?: string; builder?: string; thumb_url?: string | null; image_url?: string | null; extra_price?: number; price?: number; color?: string | null }
interface Comp { ingredient_id: string; role: Role; default_qty: number; max_qty: number; price_override: number | null; is_free: boolean; layer_order: number }
interface SauceRow { sauce_id: string; included_qty: number; is_default: boolean; max_qty: number; price_override: number | null; sort_order: number }
interface Opt { name_ar: string; name_en: string; price_delta: number; is_default: boolean; is_active: boolean; inventory_id: string | null; sort_order: number }
interface Group { name_ar: string; name_en: string; selection: 'single' | 'multiple'; is_required: boolean; max_select: number; sort_order: number; options: Opt[] }
export interface ProductDraft {
  id?: string; category_id: string; slug: string; builder: 'burger' | 'shawarma' | 'simple'; name_ar: string; name_en: string;
  description_ar: string; description_en: string; image_url: string | null; base_price: number | null; is_active: boolean; is_available: boolean;
  is_featured: boolean; inventory_id: string | null; inventory_qty: number; sort_order: number; ingredients: Comp[]; sauces: SauceRow[]; groups: Group[];
}

const sar = (h: number | null) => (h == null ? '' : (h / 100).toFixed(2));
const hal = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100));

export function ProductEditor({ initial, categories, ingredients, sauces, inventory }: {
  initial: ProductDraft; categories: { id: string; kind: string; name_ar: string; name_en: string }[];
  ingredients: Lib[]; sauces: Lib[]; inventory: { id: string; name_ar: string; name_en: string }[];
}) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [p, setP] = useState<ProductDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const kind = categories.find((c) => c.id === p.category_id)?.kind;
  const view = p.builder === 'shawarma' ? 'shawarma' : 'burger';
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setP((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/menu/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row: p }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: `${t.errors[json.error as keyof typeof t.errors] ?? a.common.error}${json.detail?.issues ? ` (${json.detail.issues.join(', ')})` : ''}` });
    setMsg({ ok: true, text: a.menu.saved });
    if (!p.id) router.replace(`/admin/menu/${json.id}`);
    router.refresh();
  };
  const remove = async () => {
    if (!p.id || !confirm(a.menu.deleteConfirm)) return;
    await fetch('/api/admin/menu/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: p.id }) });
    router.replace('/admin/menu');
    router.refresh();
  };

  const comp = [...p.ingredients].sort((x, y) => x.layer_order - y.layer_order);
  const unused = ingredients.filter((i) => !p.ingredients.some((c) => c.ingredient_id === i.id) && (i.builder === 'any' || i.builder === view));
  const unusedSauces = sauces.filter((s) => !p.sauces.some((c) => c.sauce_id === s.id));
  const updComp = (id: string, patch: Partial<Comp>) => set('ingredients', p.ingredients.map((c) => (c.ingredient_id === id ? { ...c, ...patch } : c)));
  const move = (id: string, dir: -1 | 1) => {
    const list = [...comp];
    const i = list.findIndex((c) => c.ingredient_id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set('ingredients', list.map((c, k) => ({ ...c, layer_order: k * 10 })));
  };

  return (
    <div className="space-y-5 pb-24" data-testid="product-editor">
      <section className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-2">
        <label><span className="label">{a.menu.category}</span>
          <select className="field" value={p.category_id} onChange={(e) => {
            const k = categories.find((c) => c.id === e.target.value)?.kind;
            setP((x) => ({ ...x, category_id: e.target.value, builder: k === 'fries' ? 'simple' : k === 'shawarma' ? 'shawarma' : k === 'burger' ? 'burger' : x.builder }));
          }}>
            {categories.map((c) => <option key={c.id} value={c.id}>{n(c)}</option>)}
          </select></label>
        <label><span className="label">{a.menu.builder}</span>
          <select className="field" value={p.builder} onChange={(e) => set('builder', e.target.value as ProductDraft['builder'])}>
            {kind !== 'fries' && kind !== 'shawarma' && <option value="burger">{a.menu.builderBurger}</option>}
            {kind !== 'fries' && kind !== 'burger' && <option value="shawarma">{a.menu.builderShawarma}</option>}
            <option value="simple">{a.menu.builderSimple}</option>
          </select></label>
        <label><span className="label">{a.menu.nameAr}</span><input className="field" value={p.name_ar} onChange={(e) => set('name_ar', e.target.value)} data-testid="p-name-ar" /></label>
        <label><span className="label">{a.menu.nameEn}</span><input className="field" dir="ltr" value={p.name_en} onChange={(e) => set('name_en', e.target.value)} data-testid="p-name-en" /></label>
        <label><span className="label">{a.menu.descAr}</span><textarea className="field" value={p.description_ar} onChange={(e) => set('description_ar', e.target.value)} /></label>
        <label><span className="label">{a.menu.descEn}</span><textarea className="field" dir="ltr" value={p.description_en} onChange={(e) => set('description_en', e.target.value)} /></label>
        <label><span className="label">{a.menu.slug}</span><input className="field" dir="ltr" value={p.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} data-testid="p-slug" /></label>
        <label><span className="label">{a.menu.price}</span>
          <input className="field num" dir="ltr" inputMode="decimal" defaultValue={sar(p.base_price)} onBlur={(e) => set('base_price', hal(e.target.value))} data-testid="p-price" />
          {p.base_price == null && <span className="mt-1 block text-xs text-warn-500">{a.menu.notPriced}</span>}</label>
        <div className="sm:col-span-2">
          <ImageInput name="image_url" label={a.menu.image} defaultValue={p.image_url} folder="products" checker onChange={(v) => set('image_url', v || null)} />
        </div>
        <label><span className="label">{a.menu.stock}</span>
          <select className="field" value={p.inventory_id ?? ''} onChange={(e) => set('inventory_id', e.target.value || null)}>
            <option value="">{a.menu.none}</option>
            {inventory.map((i) => <option key={i.id} value={i.id}>{n(i)}</option>)}
          </select></label>
        <label><span className="label">{a.menu.sort}</span><input type="number" className="field" value={p.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} /></label>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          {(['is_active', 'is_available', 'is_featured'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5" checked={p[k]} onChange={(e) => set(k, e.target.checked)} data-testid={`p-${k}`} />
              {k === 'is_active' ? a.menu.active : k === 'is_available' ? a.menu.available : a.menu.featured}
            </label>
          ))}
        </div>
      </section>

      {p.builder !== 'simple' && (
        <section className="glass rounded-3xl p-5">
          <h2 className="mb-1 font-bold">{a.menu.composition}</h2>
          <p className="mb-3 text-xs text-espresso-500">{p.builder === 'burger' ? a.menu.burgerNeedsBun : a.menu.breadRuleShawarma}</p>
          <ul className="space-y-2">
            {comp.map((c, idx) => {
              const ing = ingredients.find((i) => i.id === c.ingredient_id);
              if (!ing) return null;
              return (
                <li key={c.ingredient_id} className="grid items-end gap-2 rounded-2xl bg-cream-100/70 p-3 sm:grid-cols-[auto_1.4fr_repeat(4,1fr)_auto]">
                  <div className="flex flex-col">
                    <button type="button" className="p-1" onClick={() => move(c.ingredient_id, -1)} disabled={idx === 0} aria-label="up"><ArrowUp className="size-4" /></button>
                    <button type="button" className="p-1" onClick={() => move(c.ingredient_id, 1)} disabled={idx === comp.length - 1} aria-label="down"><ArrowDown className="size-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {ing.thumb_url && <img src={ing.thumb_url} alt="" className="size-10 object-contain" />}
                    <span className="font-semibold">{n(ing)}</span>
                  </div>
                  <label className="text-xs"><span className="mb-1 block">{a.menu.role}</span>
                    <select className="field min-h-10 py-1.5" value={c.role} onChange={(e) => updComp(c.ingredient_id, { role: e.target.value as Role, default_qty: e.target.value === 'extra' ? 0 : Math.max(c.default_qty, 1) })}>
                      <option value="base">{a.menu.roleBase}</option><option value="default">{a.menu.roleDefault}</option>
                      <option value="extra">{a.menu.roleExtra}</option>{ing.kind === 'bread' && <option value="bread_choice">{a.menu.roleBread}</option>}
                    </select></label>
                  <label className="text-xs"><span className="mb-1 block">{a.menu.defQty}</span>
                    <input type="number" min={c.role === 'base' ? 1 : 0} max={10} className="field min-h-10 py-1.5" value={c.default_qty} onChange={(e) => updComp(c.ingredient_id, { default_qty: Number(e.target.value) })} /></label>
                  <label className="text-xs"><span className="mb-1 block">{a.menu.maxQty}</span>
                    <input type="number" min={1} max={10} className="field min-h-10 py-1.5" value={c.max_qty} onChange={(e) => updComp(c.ingredient_id, { max_qty: Number(e.target.value) })} /></label>
                  <label className="text-xs"><span className="mb-1 block">{a.menu.priceOverride}</span>
                    <input className="field num min-h-10 py-1.5" dir="ltr" inputMode="decimal" placeholder={sar(ing.extra_price ?? 0)} defaultValue={sar(c.price_override)} onBlur={(e) => updComp(c.ingredient_id, { price_override: hal(e.target.value) })} /></label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.is_free} onChange={(e) => updComp(c.ingredient_id, { is_free: e.target.checked })} /> {a.menu.free}</label>
                    <button type="button" className="p-1 text-danger-500" onClick={() => set('ingredients', p.ingredients.filter((x) => x.ingredient_id !== c.ingredient_id))} aria-label={a.menu.delete}><Trash2 className="size-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
          {unused.length > 0 && (
            <select className="field mt-3 max-w-xs" value="" onChange={(e) => {
              const ing = ingredients.find((i) => i.id === e.target.value);
              if (!ing) return;
              const role: Role = ing.kind === 'bread' ? (p.builder === 'shawarma' ? 'bread_choice' : 'base') : 'default';
              set('ingredients', [...p.ingredients, { ingredient_id: ing.id, role, default_qty: 1, max_qty: role === 'bread_choice' || role === 'base' && ing.kind === 'bread' ? 1 : 2, price_override: null, is_free: ing.kind === 'bread', layer_order: (comp.at(-1)?.layer_order ?? -10) + 10 }]);
            }} data-testid="add-ingredient">
              <option value="">+ {a.menu.addIngredient}</option>
              {unused.map((i) => <option key={i.id} value={i.id}>{n(i)}</option>)}
            </select>
          )}
        </section>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-bold">{a.menu.sauces}</h2>
        <ul className="space-y-2">
          {p.sauces.map((s) => {
            const lib = sauces.find((x) => x.id === s.sauce_id);
            if (!lib) return null;
            const upd = (patch: Partial<SauceRow>) => set('sauces', p.sauces.map((x) => (x.sauce_id === s.sauce_id ? { ...x, ...patch } : x)));
            return (
              <li key={s.sauce_id} className="grid items-end gap-2 rounded-2xl bg-cream-100/70 p-3 sm:grid-cols-[1.4fr_repeat(3,1fr)_auto]">
                <span className="flex items-center gap-2 font-semibold"><span className="size-5 rounded-full" style={{ background: lib.color ?? '#ccc' }} /> {n(lib)}</span>
                <label className="text-xs"><span className="mb-1 block">{a.menu.includedQty}</span><input type="number" min={0} max={5} className="field min-h-10 py-1.5" value={s.included_qty} onChange={(e) => upd({ included_qty: Number(e.target.value) })} /></label>
                <label className="text-xs"><span className="mb-1 block">{a.menu.maxQty}</span><input type="number" min={1} max={5} className="field min-h-10 py-1.5" value={s.max_qty} onChange={(e) => upd({ max_qty: Number(e.target.value) })} /></label>
                <label className="text-xs"><span className="mb-1 block">{a.menu.priceOverride}</span><input className="field num min-h-10 py-1.5" dir="ltr" placeholder={sar(lib.price ?? 0)} defaultValue={sar(s.price_override)} onBlur={(e) => upd({ price_override: hal(e.target.value) })} /></label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.is_default} onChange={(e) => upd({ is_default: e.target.checked })} /> {a.menu.default}</label>
                  <button type="button" className="p-1 text-danger-500" onClick={() => set('sauces', p.sauces.filter((x) => x.sauce_id !== s.sauce_id))}><Trash2 className="size-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
        {unusedSauces.length > 0 && (
          <select className="field mt-3 max-w-xs" value="" onChange={(e) => e.target.value && set('sauces', [...p.sauces, { sauce_id: e.target.value, included_qty: 0, is_default: false, max_qty: 2, price_override: null, sort_order: p.sauces.length }])}>
            <option value="">+ {a.menu.addSauce}</option>
            {unusedSauces.map((s) => <option key={s.id} value={s.id}>{n(s)}</option>)}
          </select>
        )}
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{a.menu.options}</h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('groups', [...p.groups, { name_ar: '', name_en: '', selection: 'single', is_required: false, max_select: 1, sort_order: p.groups.length, options: [] }])}><Plus className="size-4" /> {a.menu.addGroup}</button>
        </div>
        {p.groups.map((g, gi) => {
          const updG = (patch: Partial<Group>) => set('groups', p.groups.map((x, k) => (k === gi ? { ...x, ...patch } : x)));
          return (
            <div key={gi} className="mb-3 space-y-2 rounded-2xl bg-cream-100/70 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto]">
                <input className="field" placeholder={a.menu.nameAr} value={g.name_ar} onChange={(e) => updG({ name_ar: e.target.value })} />
                <input className="field" dir="ltr" placeholder={a.menu.nameEn} value={g.name_en} onChange={(e) => updG({ name_en: e.target.value })} />
                <select className="field" value={g.selection} onChange={(e) => updG({ selection: e.target.value as Group['selection'] })}><option value="single">{a.menu.single}</option><option value="multiple">{a.menu.multiple}</option></select>
                <input type="number" min={1} className="field w-20" title={a.menu.maxSelect} value={g.max_select} onChange={(e) => updG({ max_select: Number(e.target.value) })} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={g.is_required} onChange={(e) => updG({ is_required: e.target.checked })} /> {a.menu.required}</label>
                <button type="button" className="p-1 text-danger-500" onClick={() => set('groups', p.groups.filter((_, k) => k !== gi))}><Trash2 className="size-4" /></button>
              </div>
              {g.options.map((o, oi) => {
                const updO = (patch: Partial<Opt>) => updG({ options: g.options.map((x, k) => (k === oi ? { ...x, ...patch } : x)) });
                return (
                  <div key={oi} className="grid gap-2 ps-4 sm:grid-cols-[1fr_1fr_8rem_auto_auto]">
                    <input className="field min-h-10 py-1.5" placeholder={a.menu.nameAr} value={o.name_ar} onChange={(e) => updO({ name_ar: e.target.value })} />
                    <input className="field min-h-10 py-1.5" dir="ltr" placeholder={a.menu.nameEn} value={o.name_en} onChange={(e) => updO({ name_en: e.target.value })} />
                    <input className="field num min-h-10 py-1.5" dir="ltr" placeholder={a.menu.priceDelta} defaultValue={sar(o.price_delta)} onBlur={(e) => updO({ price_delta: hal(e.target.value) ?? 0 })} />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={o.is_default} onChange={(e) => updO({ is_default: e.target.checked })} /> {a.menu.default}</label>
                    <button type="button" className="p-1 text-danger-500" onClick={() => updG({ options: g.options.filter((_, k) => k !== oi) })}><Trash2 className="size-4" /></button>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm btn-ghost ms-4" onClick={() => updG({ options: [...g.options, { name_ar: '', name_en: '', price_delta: 0, is_default: false, is_active: true, inventory_id: null, sort_order: g.options.length }] })}><Plus className="size-4" /> {a.menu.addOption}</button>
            </div>
          );
        })}
      </section>

      <div className="glass fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-full p-2 shadow-lift lg:ms-[260px]">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy} data-testid="p-save"><Save className="size-4" /> {busy ? a.common.loading : a.common.save}</button>
        {p.id && <button type="button" className="btn btn-ghost text-danger-500" onClick={remove}><Trash2 className="size-4" /> {a.common.delete}</button>}
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-ok-500' : 'text-danger-500'}`} data-testid="p-msg">{msg.text}</span>}
      </div>
    </div>
  );
}
