'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import s from '@/app/os/os.module.css';

const SHELL_ID = 'ward-shell';
const shell = () => document.getElementById(SHELL_ID);
const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return { ok: res.ok, data };
}

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  count?: number;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className={s.nav} aria-label="WARD OS">
      {items.map((item) => {
        const active = item.href === '/os' ? pathname === '/os' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={s.navItem}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            onClick={() => shell()?.setAttribute('data-open', 'false')}
          >
            <Icon name={item.icon} className={s.navIcon} />
            <span className={s.label}>{item.label}</span>
            {item.count ? <span className={s.navCount}>{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MenuButton({ label }: { label: string }) {
  return (
    <button type="button" className={`${s.iconBtn} ${s.menuBtn}`} aria-label={label} onClick={() => shell()?.setAttribute('data-open', 'true')}>
      <Icon name="menu" />
    </button>
  );
}

export function Scrim() {
  return <div className={s.scrim} onClick={() => shell()?.setAttribute('data-open', 'false')} aria-hidden />;
}

export function CollapseButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className={`${s.iconBtn} ${s.collapseBtn}`}
      aria-label={label}
      title={label}
      onClick={() => {
        const el = shell();
        const next = el?.getAttribute('data-collapsed') === 'true' ? 'false' : 'true';
        el?.setAttribute('data-collapsed', next);
        setCookie('ward_sidebar', next === 'true' ? 'collapsed' : 'open');
      }}
    >
      <Icon name="sidebar" />
    </button>
  );
}

export function ThemeButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className={s.iconBtn}
      aria-label={label}
      title={label}
      onClick={() => {
        const root = document.documentElement;
        const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const next = current === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        setCookie('ward_theme', next);
      }}
    >
      <Icon name="moon" />
    </button>
  );
}

export function LangButton({ label, next }: { label: string; next: 'ar' | 'en' }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={s.iconBtn}
      aria-label={label}
      title={label}
      onClick={() => {
        setCookie('ward_locale', next);
        router.refresh();
      }}
    >
      <Icon name="globe" />
    </button>
  );
}

export function KillSwitch({ paused, stopLabel, resumeLabel, confirmText }: { paused: boolean; stopLabel: string; resumeLabel: string; confirmText: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn-sm ${paused ? 'btn-sand' : 'btn-danger'}`}
      disabled={pending}
      onClick={() => {
        if (!paused && !confirm(confirmText)) return;
        start(async () => {
          await postJson('/api/os/kill-switch', { paused: !paused });
          router.refresh();
        });
      }}
    >
      <Icon name={paused ? 'play' : 'stop'} size={14} />
      <span>{paused ? resumeLabel : stopLabel}</span>
    </button>
  );
}

export function CommandBox(props: { placeholder: string; send: string; limitLabel: string; defaultLimit: number; disabled?: boolean; disabledNote?: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [limit, setLimit] = useState(String(props.defaultLimit));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const { ok, data } = await postJson('/api/os/workflows', { command: text, cost_limit_usd: limit });
      if (ok && typeof data.id === 'string') router.push(`/os/runs/${data.id}`);
      else setError(String(data.message ?? data.error ?? 'error'));
    });
  return (
    <form
      className={s.command}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length >= 3) submit();
      }}
    >
      <textarea
        className={s.commandInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={props.placeholder}
        rows={2}
        maxLength={4000}
        disabled={props.disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim().length >= 3) submit();
        }}
      />
      <div className={s.commandBar}>
        <label className="row small muted">
          {props.limitLabel}
          <input className="input ltr" style={{ width: 90, minHeight: 32, padding: '4px 10px' }} type="number" min="0.05" max="100" step="0.05" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <div className="row">
          {error && <span className="small" style={{ color: 'var(--bad)' }}>{error}</span>}
          {props.disabled && props.disabledNote && <span className="small muted">{props.disabledNote}</span>}
          <button className="btn btn-primary" disabled={pending || props.disabled || text.trim().length < 3}>
            {props.send} <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}

/** Re-renders the server page every few seconds while something is still running. */
export function LiveRefresh({ active, intervalMs = 2500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  priorityLabel: string;
  due: string | null;
  assignee: string | null;
  overdue: boolean;
}

export function Kanban({ columns, tasks }: { columns: { key: string; label: string }[]; tasks: KanbanTask[] }) {
  const router = useRouter();
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [items, setItems] = useState(tasks);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setItems(tasks), [tasks]);

  const move = async (id: string, status: string) => {
    const prev = items;
    setItems((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    const res = await fetch(`/api/os/tasks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setItems(prev);
      setError(data.message ?? data.error ?? 'error');
      setTimeout(() => setError(null), 5000);
    }
    router.refresh();
  };

  return (
    <div className="stack">
      {error && <div className="notice bad">{error}</div>}
      <div className={s.kanban}>
        {columns.map((col) => {
          const list = items.filter((t) => t.status === col.key);
          return (
            <section
              key={col.key}
              className={s.column}
              data-over={over === col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id && items.find((t) => t.id === id)?.status !== col.key) void move(id, col.key);
              }}
            >
              <header className={s.columnHead}>
                <span>{col.label}</span>
                <span>{list.length}</span>
              </header>
              {list.map((t) => (
                <article
                  key={t.id}
                  className={s.taskCard}
                  draggable
                  data-dragging={dragging === t.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', t.id);
                    setDragging(t.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <Link href={`/os/tasks/${t.id}`} style={{ fontWeight: 500 }}>
                    {t.title}
                  </Link>
                  <div className="row small">
                    <span className={`badge plain ${t.priority === 'urgent' || t.priority === 'high' ? 'warn' : ''}`}>{t.priorityLabel}</span>
                    {t.due && <span className={t.overdue ? '' : 'muted'} style={t.overdue ? { color: 'var(--bad)' } : undefined}>{t.due}</span>}
                    {t.assignee && <span className="faint">{t.assignee}</span>}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function AgentChat({ slug, placeholder, send }: { slug: string; placeholder: string; send: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [messages]);

  const ask = async () => {
    const history = [...messages, { role: 'user' as const, content: text.trim() }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setText('');
    setBusy(true);
    try {
      const res = await fetch(`/api/os/agents/${slug}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history }) });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: acc }]);
      }
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'error'}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className={s.chat}>
        {messages.map((m, i) => (
          <div key={i} className={s.bubble} data-me={m.role === 'user'}>
            {m.content || '…'}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !busy) void ask();
        }}
      >
        <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={8000} />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          {send}
        </button>
      </form>
    </div>
  );
}

export function ConfirmSubmit({ children, message, className = 'btn btn-sm' }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
