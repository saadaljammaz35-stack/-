import { translator, type Key } from "@/lib/i18n";
import { areaLabel, mmss, SEVERITY_ORDER } from "@/lib/report-labels";
import { shortId, type FullReport } from "@/lib/reports";

/**
 * The report, short first: condition and summary, the price, what matters
 * most, what to check, the photos. Everything else (all findings, seller
 * claims, coverage, traceability) is one tap away under "Full details".
 */
export function ReportView({ full, pdfHref }: { full: FullReport; pdfHref: string }) {
  const { report, findings, inspection, attempt, evidence } = full;
  const L = report.language;
  const t = translator(L);
  const b = report.body;
  const refOf = new Map(evidence.map((e) => [e.id, e]));
  const sorted = [...findings].sort((a, z) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[z.severity] || a.position - z.position);
  const issues = sorted.filter((f) => f.severity !== "info").slice(0, 5);
  const good = sorted.find((f) => f.severity === "info");
  const checks = b.recommended_checks.slice(0, 4);
  const date = new Intl.DateTimeFormat(L === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Riyadh" });
  const num = new Intl.NumberFormat(L === "ar" ? "ar-SA-u-nu-latn" : "en-GB");
  const Refs = ({ ids }: { ids: string[] }) => (
    <span className="row" style={{ gap: 6, display: "inline-flex" }}>
      {ids.map((id) => { const e = refOf.get(id); return e ? <a key={id} className="ref" href={`#${e.ref}`}>{e.ref}</a> : null; })}
    </span>
  );
  const List = ({ items }: { items: string[] }) => (items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">—</p>);
  const circ = 2 * Math.PI * 52;
  const priced = "price_estimate" in b; // reports from before the price step have no price section
  const p = b.price_estimate ?? null;
  return (
    <article dir={L === "ar" ? "rtl" : "ltr"} lang={L} className="stack">
      <div className="spread">
        <div>
          <span className="eyebrow">{t("rp_title")} · #{shortId(report.id)}</span>
          <h1 style={{ fontSize: "2rem", margin: "6px 0" }}>{inspection.brand} {inspection.model}{inspection.storage ? ` · ${inspection.storage}` : ""}</h1>
          <div className="small muted">{date.format(attempt.finished_at ?? report.created_at)}</div>
        </div>
        <a className="btn btn-signal" href={pdfHref}>{t("rp_download")}</a>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 22, alignItems: "center", flexWrap: "nowrap" }}>
          <svg className="score-ring" viewBox="0 0 120 120" role="img" aria-label={`${report.condition_score}/100`} style={{ flex: "none" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#ebe5d8" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#121a24" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(circ * report.condition_score) / 100} ${circ}`} transform="rotate(-90 60 60)" />
            <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="600" fill="#121a24">{report.condition_score}</text>
          </svg>
          <div>
            <div className="small muted">{t("rp_overall")}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", lineHeight: 1.3 }}>{t(`cond_${report.overall_condition}` as Key)}</div>
          </div>
        </div>
        <p style={{ margin: "14px 0 0", fontSize: "1.05rem" }}>{b.summary}</p>
      </div>

      {priced && (
        <section className="card price-card">
          <div className="small muted">{t("rp_price")}</div>
          {p && p.low !== null && p.high !== null ? (
            <div className="price-range">
              {num.format(p.low)} – {num.format(p.high)} <span>{t("rp_currency")}</span>
            </div>
          ) : (
            <p style={{ margin: "6px 0" }}>{t("rp_price_none")}</p>
          )}
          {p && p.asking_price_verdict !== "no_asking_price" && (
            <p style={{ margin: "6px 0" }}>
              {t("rp_asking")}: <strong>{t(`ask_${p.asking_price_verdict}` as Key)}</strong>
            </p>
          )}
          {p?.basis && <p className="small" style={{ margin: "6px 0" }}>{p.basis}</p>}
          {p && p.sources.length > 0 && (
            <p className="small muted" style={{ margin: "6px 0", overflowWrap: "anywhere" }}>
              {t("rp_sources")}:{" "}
              {p.sources.map((s, i) => (
                <span key={s.url}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{new URL(s.url).hostname.replace(/^www\./, "")}</a></span>
              ))}
            </p>
          )}
          <p className="small muted" style={{ margin: "6px 0 0" }}>{t("rp_price_note")}</p>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: "1.25rem" }}>{t("rp_top")}</h2>
        {issues.length === 0 && <p>{t("rp_no_issues")}</p>}
        {issues.map((f) => (
          <div className="finding" key={f.id}>
            <div className="finding-head">
              <span className={`chip sev sev-${f.severity}`}>{t(`sev_${f.severity}` as Key)}</span>
              <strong>{f.title}</strong>
              <Refs ids={f.evidence_ids} />
            </div>
            <p className="small" style={{ margin: 0 }}>{f.detail}</p>
          </div>
        ))}
        {good && <p className="small" style={{ marginTop: 10 }}>✓ {good.title} <Refs ids={good.evidence_ids} /></p>}
      </section>

      {checks.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: "1.25rem" }}>{t("rp_checks")}</h2>
          <List items={checks} />
        </section>
      )}

      <section>
        <h2 style={{ fontSize: "1.25rem" }}>{t("rp_photos")}</h2>
        <div className="ev-grid">
          {evidence.map((e) => (
            <figure className="ev-tile" id={e.ref} key={e.id} style={{ margin: 0 }}>
              <a className="thumb" href={`/api/evidence/${e.id}/file`} target="_blank" rel="noopener"><img src={`/api/evidence/${e.id}/file`} alt={e.ref} loading="lazy" /></a>
              <figcaption className="meta">
                <span><span className="ref">{e.ref}</span> {e.kind === "video_frame" ? `${t("frame_at")} ${mmss(e.frame_time_ms)}` : t("photo")}{e.label ? ` · ${e.label}` : ""}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <details className="card-flat">
        <summary><strong>{t("rp_details")}</strong></summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="small"><strong>{t("rp_device_match")}</strong> {t(`match_${b.device_match.matches_declared_device}` as Key)} — {b.device_match.observed_device}. <span className="muted">{b.device_match.reasoning}</span></p>
          <p className="small"><strong>{t("rp_quality")}:</strong> {t(`q_${b.evidence_quality.rating}` as Key)}{b.evidence_quality.issues.length > 0 && <> · <span className="muted">{b.evidence_quality.issues.join(" · ")}</span></>} · <strong>{t("rp_confidence")}:</strong> {t(`conf_${report.confidence}` as Key)}</p>

          <h3>{t("rp_all_findings")} ({sorted.length})</h3>
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

          {b.seller_claims_check.length > 0 && (
            <>
              <h3>{t("rp_claims")}</h3>
              <div className="table-wrap" style={{ boxShadow: "none" }}>
                <table className="t"><tbody>
                  {b.seller_claims_check.map((c, i) => (
                    <tr key={i}><td>{c.claim}</td><td><strong>{t(`v_${c.verdict}` as Key)}</strong></td><td>{c.explanation} <Refs ids={c.evidence_ids} /></td></tr>
                  ))}
                </tbody></table>
              </div>
            </>
          )}

          <div className="grid-2">
            <section><h3>{t("rp_not_covered")}</h3><List items={b.areas_not_covered} /></section>
            <section><h3>{t("rp_limitations")}</h3><List items={b.limitations} /></section>
          </div>

          <p className="mono small">
            {t("rp_trace")}: report {report.id} · v{report.version} · analysis {attempt.id} · {attempt.model} · {attempt.prompt_version}{attempt.request_id ? ` · ${attempt.request_id}` : ""}
            {p?.request_id ? ` · price ${p.request_id} · ${p.searches} search` : ""}
          </p>
        </div>
      </details>
      <div className="disclaimer">{t("rp_disclaimer")}</div>
    </article>
  );
}
