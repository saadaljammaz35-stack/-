import Link from 'next/link';

export interface QueueCardProps {
  label: string;
  count: number;
  href: string;
  tone?: 'ok' | 'warning' | 'critical';
}

export function QueueCard(props: QueueCardProps): React.JSX.Element {
  return (
    <Link href={props.href} className={`tile tile--link tile--${props.tone ?? 'neutral'}`}>
      <span className="tile__label">{props.label}</span>
      <span className="tile__value">{props.count}</span>
      {props.count > 0 && <span className="tile__hint">Needs attention</span>}
    </Link>
  );
}
