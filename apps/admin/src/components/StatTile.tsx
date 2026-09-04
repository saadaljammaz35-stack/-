export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warning' | 'critical';
}

export function StatTile(props: StatTileProps): React.JSX.Element {
  return (
    <div className={`tile tile--${props.tone ?? 'neutral'}`}>
      <span className="tile__label">{props.label}</span>
      {/* Tabular figures so a value does not jitter as it refreshes — a
          number that shifts width reads as unreliable. */}
      <span className="tile__value">{props.value}</span>
      {props.hint !== undefined && <span className="tile__hint">{props.hint}</span>}
    </div>
  );
}
