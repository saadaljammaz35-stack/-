import { translator, type Key } from "@/lib/i18n";
import { areaLabel, mmss, SEVERITY_ORDER } from "@/lib/report-labels";
import { shortId, type FullReport } from "@/lib/reports";

export function ReportView({ full, pdfHref }: { full: FullReport; pdfHref: string }) {
  const { report, findings, inspection, attempt, evidence } = full;
  const L = report.language;
  const t = translator(L);
  const b = report.body;
  const refOf = new Map(evidence.map((e) => [e.id, e]));
  const sorted = [...findings].sort((a, z) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[z.severity] || a.position - z.position);
  const date = new Intl.DateTimeFormat(L === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Riyadh" });
  const Refs = ({ ids }: { ids: string[] }) => (
    <span className="row" style={{ gap: 6, display: "inline-flex" }}>
      {ids.map((id) => { const e = refOf.get(id); return e ? <a key={id} className="ref" href={`#${e.ref}`}>{e.ref}</a> : null; })}
    </span>
  );
  const List = ({ items }: { items: string[] }) => (items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">—</p>);
  const circ = 2 * Math.PI * 52;
  return (
    <article dir={L === "ar" ? "rtl" : "ltr"} lang={L} className="stack">
      <div className="spread">
        <div>
          <span className="eyebrow">{t("rp_title")} · #{shortId(report.id)} · {t("rp_version")} {report.version}</span>
          <h1 style={{ fontSize: "2rem", margin: "6px 0" }}>{inspection.brand} {inspection.model}</h1>
          <div className="small muted">{t("rp_generated")}: {date.format(attempt.finished_at ?? report.created_at)}</div>
        </div>
        <a className="btn btn-signal" href={pdfHref}>{t("rp_download")}</a>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 28, alignItems: "center" }}>
          <svg className="score-ring" viewBox="0 0 120 120" role="img" aria-label={`${report.condition_score}/100`}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#ebe5d8" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#121a24" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(circ * report.condition_score) / 100} ${circ}`} transform="rotate(-90 60 60)" />
            <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="600" fill="#121a24">{report.condition_score}</text>
          </svg>
          <div className="kpis" style={{ flex: 1 }}>
            <div className="kpi"><span>{t("rp_overall")}</span><b>{t(`cond_${report.overall_condition}` as Key)}</b></div>
            <div className="kpi"><span>{t("rp_confidence")}</span><b>{t(`conf_${report.confidence}` as Key)}</b></div>
            <div className="kpi"><span>{t("rp_quality")}</span><b>{t(`q_${b.evidence_quality.rating}` as Key)}</b></div>
          </div>
        </div>
      </div>

      <section className="card">
        <h2 style={{ fontSize: "1.3rem" }}>{t("rp_summary")}</h2>
        <p>{b.summary}</p>
        <p className="small"><strong>{t("rp_device_match")}</strong> {t(`match_${b.device_match.matches_declared_device}` as Key)} — {b.device_match.observed_device}. <span className="muted">{b.device_match.reasoning}</span></p>
        {b.evidence_quality.issues.length > 0 && <p className="small muted">{b.evidence_quality.issues.join(" · ")}</p>}
      </section>

      <section>
        <h2 style={{ fontSize: "1.3rem" }}>{t("rp_findings")} ({sorted.length})</h2>
        {sorted.map((f) => (
          <div className="finding" key={f.id}>
            <div className="finding-head">
              <span className={`chip sev sev-${f.severity}`}>{t(`sev_${f.severity}` as Key)}</span>
              <strong>{f.title}</strong>
              <span className="small muted">{areaLabel(f.area, L)} · {t("rp_confidence")}: {t(`conf_${f.confidence}` as Key)}</span>
            </div>
            <p style={{ margin: "0 0 8px" }}>{f.detail}</p>
            <div className="small">{t("rp_evidence")}: <Refs ids={f.evidence_ids} /></div>
          </div>
        ))}
      </section>

      {b.seller_claims_check.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: "1.3rem" }}>{t("rp_claims")}</h2>
          <div className="table-wrap" style={{ boxShadow: "none" }}>
            <table className="t"><tbody>
              {b.seller_claims_check.map((c, i) => (
                <tr key={i}><td>{c.claim}</td><td><strong>{t(`v_${c.verdict}` as Key)}</strong></td><td>{c.explanation} <Refs ids={c.evidence_ids} /></td></tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}

      <div className="grid-3">
        <section className="card-flat"><h3>{t("rp_not_covered")}</h3><List items={b.areas_not_covered} /></section>
        <section className="card-flat"><h3>{t("rp_limitations")}</h3><List items={b.limitations} /></section>
        <section className="card-flat"><h3>{t("rp_checks")}</h3><List items={b.recommended_checks} /></section>
      </div>

      <section>
        <h2 style={{ fontSize: "1.3rem" }}>{t("rp_index")}</h2>
        <div className="ev-grid">
          {evidence.map((e) => (
            <figure className="ev-tile" id={e.ref} key={e.id} style={{ margin: 0 }}>
              <a className="thumb" href={`/api/evidence/${e.id}/file`} target="_blank" rel="noopener"><img src={`/api/evidence/${e.id}/file`} alt={e.ref} loading="lazy" /></a>
              <figcaption className="meta">
                <span><span className="ref">{e.ref}</span> {e.kind === "video_frame" ? `${t("frame_at")} ${mmss(e.frame_time_ms)}` : t("photo")}{e.label ? ` · ${e.label}` : ""}</span>
                <span className="mono muted">sha256 {e.sha256.slice(0, 12)}…</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <details className="card-flat">
        <summary><strong>{t("rp_trace")}</strong></summary>
        <p className="mono small" style={{ marginTop: 10 }}>
          report {report.id} · v{report.version}<br />
          analysis {attempt.id} · {attempt.model} · {attempt.prompt_version}{attempt.request_id ? ` · ${attempt.request_id}` : ""}<br />
          processed {new Date(attempt.finished_at ?? report.created_at).toISOString()}
        </p>
      </details>
      <div className="disclaimer">{t("rp_disclaimer")}</div>
    </article>
  );
}

