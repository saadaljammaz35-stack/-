import s from '@/app/os/os.module.css';
import { label, type Locale } from '@/lib/i18n';

const OK = new Set(['completed', 'approved', 'executed', 'done', 'published', 'verified', 'active', 'confirmed', 'received', 'paid', 'delivered', 'idle', 'ok', 'configured', 'signed']);
const BAD = new Set(['failed', 'rejected', 'cancelled', 'blocked', 'declined', 'missed', 'error', 'dead', 'disabled', 'missing']);
const LIVE = new Set(['queued', 'planning', 'running', 'reviewing', 'working', 'in_progress', 'shooting', 'editing']);

export function tone(status: string | null | undefined): string {
  if (!status) return '';
  if (OK.has(status)) return 'ok';
  if (BAD.has(status)) return 'bad';
  if (LIVE.has(status)) return 'warn live';
  return 'warn';
}

export function StatusBadge({ status, locale }: { status: string | null | undefined; locale: Locale }) {
  return <span className={`badge ${tone(status)}`}>{label(locale, status)}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className={`${s.pageHead} fade-in`}>
      <div>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle && <p className={s.pageSub}>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Stat({ value, label: text }: { value: React.ReactNode; label: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statValue}>{value}</span>
      <span className={s.statLabel}>{text}</span>
    </div>
  );
}

export function StatsRow({ children }: { children: React.ReactNode }) {
  return <div className={s.statsRow}>{children}</div>;
}

export function Card({ title, action, children, id }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="card fade-in" id={id}>
      {(title || action) && (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const error = typeof params.error === 'string' ? params.error : null;
  const saved = params.saved || params.queued || params.checked;
  if (error) return <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>{decodeURIComponent(error)}</div>;
  if (saved) return <div className="notice" role="status" style={{ marginBottom: 16 }}>✓</div>;
  return null;
}

export function AgentMono({ name }: { name: string }) {
  return <span className={s.agentMono}>{name.replace('WARD ', '').slice(0, 1)}</span>;
}
