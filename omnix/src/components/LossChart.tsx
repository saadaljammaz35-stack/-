// Server-renderable SVG line chart for training/validation loss. No chart library.
export function LossChart({ points, labels }: { points: { step: number; train: number | null; eval: number | null }[]; labels: { train: string; eval: string } }) {
  const W = 640, H = 220, P = 32;
  const vals = points.flatMap((p) => [p.train, p.eval]).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return <div className="empty small">—</div>;
  const maxStep = Math.max(1, ...points.map((p) => p.step));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1 || 0.1;
  const y0 = lo - pad, y1 = hi + pad;
  const x = (s: number) => P + ((W - 2 * P) * s) / maxStep;
  const y = (v: number) => H - P - ((H - 2 * P) * (v - y0)) / (y1 - y0);
  const path = (k: "train" | "eval") =>
    points.filter((p) => p[k] !== null).map((p, i) => `${i ? "L" : "M"}${x(p.step).toFixed(1)},${y(p[k]!).toFixed(1)}`).join(" ");
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad];
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels.train} / ${labels.eval}`} style={{ direction: "ltr" }}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={P} x2={W - P} y1={y(v)} y2={y(v)} />
            <text x={4} y={y(v) + 4}>{v.toFixed(2)}</text>
          </g>
        ))}
        <line className="axis" x1={P} x2={W - P} y1={H - P} y2={H - P} />
        <text x={W - P} y={H - 8} textAnchor="end">step {maxStep}</text>
        <path className="line-a" d={path("train")} />
        <path className="line-b" d={path("eval")} />
      </svg>
      <div className="legend"><span><i style={{ background: "var(--accent)" }} />{labels.train}</span><span><i style={{ background: "var(--ok)" }} />{labels.eval}</span></div>
    </div>
  );
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 640, H = 180, P = 24;
  if (!data.length) return <div className="empty small">—</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - 2 * P) / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="daily" style={{ direction: "ltr" }}>
      <line className="axis" x1={P} x2={W - P} y1={H - P} y2={H - P} />
      {data.map((d, i) => {
        const h = ((H - 2 * P) * d.value) / max;
        return (
          <g key={i}>
            <rect className="bar" x={P + i * bw + 2} y={H - P - h} width={Math.max(2, bw - 4)} height={h} rx={3}><title>{`${d.label}: ${d.value}`}</title></rect>
            {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && <text x={P + i * bw + bw / 2} y={H - 6} textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
