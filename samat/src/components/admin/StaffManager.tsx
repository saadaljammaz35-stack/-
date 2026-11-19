'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { fmtDateTime } from '@/lib/time';

interface Member { user_id: string; email: string; full_name: string | null; role_key: string; is_active: boolean; last_seen_at: string | null }
interface Invite { id: string; email: string; role_key: string; created_at: string }
interface Perm { key: string; description_ar: string; description_en: string }

export function StaffManager({ me, members, invites, perms, rolePerms, overrides, isOwner }: {
  me: string; members: Member[]; invites: Invite[]; perms: Perm[]; rolePerms: { role_key: string; permission_key: string }[];
  overrides: { user_id: string; permission_key: string; allow: boolean }[]; isOwner: boolean;
}) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('orders_manager');
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const post = async (body: unknown, ok = a.common.saved) => {
    const res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setMsg(res.ok ? ok : t.errors[json.error as keyof typeof t.errors] ?? a.common.error);
    router.refresh();
    return res.ok;
  };
  const effective = (m: Member, key: string): { on: boolean; src: 'role' | 'granted' | 'denied' } => {
    const o = overrides.find((x) => x.user_id === m.user_id && x.permission_key === key);
    if (m.role_key === 'owner') return { on: true, src: 'role' };
    if (o) return { on: o.allow, src: o.allow ? 'granted' : 'denied' };
    return { on: rolePerms.some((r) => r.role_key === m.role_key && r.permission_key === key), src: 'role' };
  };

  return (
    <div className="space-y-5">
      <form className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-[1.4fr_1fr_1fr_auto]" onSubmit={async (e) => {
        e.preventDefault();
        if (await post({ action: 'invite', email, full_name: name || undefined, role_key: role }, a.staff.inviteSent)) { setEmail(''); setName(''); }
      }}>
        <input type="email" required className="field" dir="ltr" placeholder={a.staff.email} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" />
        <input className="field" placeholder={a.staff.name} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="field" value={role} onChange={(e) => setRole(e.target.value)} data-testid="invite-role">
          {(['admin', 'orders_manager', 'kitchen'] as const).map((r) => <option key={r} value={r}>{a.role[r]}</option>)}
        </select>
        <button className="btn btn-primary" data-testid="invite-submit"><UserPlus className="size-4" /> {a.staff.invite}</button>
      </form>
      {msg && <p role="status" className="text-sm" data-testid="staff-msg">{msg}</p>}

      {invites.length > 0 && (
        <section className="glass rounded-3xl p-5">
          <h2 className="mb-3 font-bold">{a.staff.invites}</h2>
          <ul className="space-y-2 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3"><Mail className="size-4" /><span dir="ltr" className="flex-1">{i.email}</span><span>{a.role[i.role_key as keyof typeof a.role]}</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => post({ action: 'revoke', id: i.id })}>{a.staff.revoke}</button></li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3" data-testid="staff-list">
        {members.map((m) => (
          <li key={m.user_id} className={`glass rounded-3xl p-4 ${m.is_active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{m.full_name || m.email} {m.user_id === me && <span className="text-xs text-espresso-500">({a.staff.you})</span>}</p>
                <p className="text-xs text-espresso-500" dir="ltr">{m.email}{m.last_seen_at ? ` · ${a.staff.lastSeen}: ${fmtDateTime(m.last_seen_at, locale)}` : ''}</p>
              </div>
              <select className="field min-h-10 w-auto py-1.5" value={m.role_key} disabled={m.user_id === me || (m.role_key === 'owner' && !isOwner)}
                onChange={(e) => post({ action: 'update', user_id: m.user_id, role_key: e.target.value })}>
                {(isOwner || m.role_key === 'owner' ? ['owner', 'admin', 'orders_manager', 'kitchen'] : ['admin', 'orders_manager', 'kitchen']).map((r) => <option key={r} value={r}>{a.role[r as keyof typeof a.role]}</option>)}
              </select>
              {m.user_id !== me && (
                <>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => post({ action: 'update', user_id: m.user_id, is_active: !m.is_active })}>{m.is_active ? a.staff.disable : a.staff.enable}</button>
                  {m.role_key !== 'owner' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(open === m.user_id ? null : m.user_id)}><ShieldCheck className="size-4" /> {a.staff.permissions}</button>}
                  {m.role_key !== 'owner' && <button type="button" className="p-1 text-danger-500" onClick={() => confirm(a.menu.deleteConfirm) && post({ action: 'delete', user_id: m.user_id })} aria-label={a.staff.remove}><Trash2 className="size-4" /></button>}
                </>
              )}
            </div>
            {open === m.user_id && (
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {perms.map((p) => {
                  const e = effective(m, p.key);
                  return (
                    <label key={p.key} className="flex items-center gap-2 rounded-xl bg-cream-100/70 px-3 py-2 text-sm">
                      <input type="checkbox" checked={e.on} onChange={(ev) => post({ action: 'override', user_id: m.user_id, permission_key: p.key, allow: ev.target.checked })} />
                      <span className="flex-1">{locale === 'ar' ? p.description_ar : p.description_en}</span>
                      <span className="text-[10px] text-espresso-500">{e.src === 'role' ? a.staff.inherited : e.src === 'granted' ? a.staff.granted : a.staff.denied}</span>
                      {e.src !== 'role' && <button type="button" className="text-xs underline" onClick={() => post({ action: 'override', user_id: m.user_id, permission_key: p.key, allow: null })}>↺</button>}
                    </label>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
