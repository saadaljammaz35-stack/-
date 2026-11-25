import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { can } from '@/lib/auth/permissions';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { formatDate, tr, usd } from '@/lib/i18n';
import { loadProject, syncProject } from '@/lib/media/montage';
import { planKeeps, planStats } from '@/lib/media/plan';
import { finalizeChapters, fmtClock } from '@/lib/media/timeline';
import { Card, Flash, PageHeader, Stat, StatsRow, StatusBadge } from '@/components/os/ui';
import { ConfirmSubmit, LiveRefresh } from '@/components/os/client';
import { MontageReview } from '@/components/os/montage';

const STAGES: Record<string, [string, string]> = {
  starting: ['تجهيز جهاز المعالجة', 'Starting the processing machine'],
  setup: ['تثبيت أدوات الفيديو والتفريغ', 'Installing video and speech tools'],
  probe: ['قراءة الملف', 'Reading the file'],
  audio: ['استخراج الصوت', 'Extracting audio'],
  silence: ['كشف الصمت', 'Detecting silences'],
  transcribe: ['التفريغ النصي (Whisper)', 'Transcribing (Whisper)'],
  plan: ['الوكيل يجهّز خطة المونتاج', 'The agent is planning the edit'],
  upload: ['رفع الملفات', 'Uploading files'],
  done: ['اكتمل', 'Done'],
};

function stageLabel(locale: 'ar' | 'en', stage: string | null): string {
  if (!stage) return '';
  if (stage.startsWith('render:')) {
    const name = stage.slice(7);
    return name === 'episode' ? tr(locale, 'إخراج الحلقة كاملة', 'Rendering the full episode') : tr(locale, `إخراج ${name.replace('short-', 'المقطع القصير ')}`, `Rendering ${name}`);
  }
  const l = STAGES[stage];
  return l ? tr(locale, ...l) : stage;
}

export default async function MontagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const first = await withOrg(session, (q) => loadProject(q, id));
  if (!first) notFound();
  if (first.status === 'analyzing' || first.status === 'rendering') await syncProject(session.orgId, id).catch(() => 'idle');

  const d = await withOrg(session, async (q) => {
    const p = (await loadProject(q, id))!;
    const ep = (await q.query<{ id: string; title: string; number: number | null }>('select id, title, number from ward.episodes where id = $1', [p.episode_id]))[0];
    const src = (await q.query<{ id: string; name: string; size: string; mime: string; duration_s: number | null }>('select id, name, size, mime, duration_s::float8 from ward.media_assets where id = $1', [p.source_asset_id]))[0];
    const renders = await q.query<{ id: string; kind: string; name: string; title: string; status: string; asset_id: string | null; thumbnail_asset_id: string | null; duration_s: number | null; error: string | null; size: string | null; spec: { hook?: string } }>(
      `select r.id, r.kind, r.name, r.title, r.status, r.asset_id, r.thumbnail_asset_id, r.duration_s::float8, r.error, a.size, r.spec
         from ward.montage_renders r left join ward.media_assets a on a.id = r.asset_id
        where r.project_id = $1 order by r.kind, r.name`,
      [id],
    );
    return { p, ep, src, renders };
  });
  const { p, ep, src } = d;
  const write = can(session.role, 'content.write');
  const active = ['analyzing', 'planning', 'rendering'].includes(p.status);
  const stats = p.plan ? planStats(p.plan) : null;
  const chapters = p.plan ? finalizeChapters(p.plan.chapters, planKeeps(p.plan)) : null;
  const mb = (n: string | number | null) => (n ? `${(Number(n) / 1024 / 1024).toFixed(Number(n) > 1e9 ? 0 : 1)} MB` : '');

  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <LiveRefresh active={active} intervalMs={5000} />
      <PageHeader
        title={tr(locale, 'المونتاج الآلي', 'Automatic edit')}
        subtitle={ep ? <Link href={`/os/episodes/${ep.id}`}>{ep.number ? `#${ep.number} · ` : ''}{ep.title}</Link> : undefined}
        actions={<StatusBadge status={p.status} locale={locale} />}
      />

      {active && (
        <Card title={p.status === 'planning' ? stageLabel(locale, 'plan') : stageLabel(locale, p.stage) || tr(locale, 'قيد المعالجة', 'Processing')}>
          <div className="meter"><span style={{ width: `${p.status === 'planning' ? 100 : Math.max(2, p.progress)}%` }} className={p.status === 'planning' ? 'indeterminate' : ''} /></div>
          <p className="small faint" style={{ marginTop: 10 }}>
            {p.status === 'analyzing' && p.transcript_source === 'whisper'
              ? tr(locale, 'التفريغ الصوتي يعمل على جهاز معالجة مستقل ويأخذ تقريبًا ثلث مدة الحلقة. تقدر تقفل الصفحة — ستصلك تنبيهات عند الجاهزية.', 'Transcription runs on a separate machine and takes roughly a third of the episode length. You can close this page — you will be notified.')
              : tr(locale, 'تقدر تقفل الصفحة — ستصلك تنبيهات عند الجاهزية.', 'You can close this page — you will be notified.')}
          </p>
          {write && (
            <form action={`/api/os/montage/${p.id}`} method="post" style={{ marginTop: 10 }}>
              <input type="hidden" name="action" value="cancel" />
              <ConfirmSubmit message={tr(locale, 'إيقاف المعالجة؟', 'Stop processing?')} className="btn btn-sm btn-ghost">{tr(locale, 'إيقاف', 'Stop')}</ConfirmSubmit>
            </form>
          )}
        </Card>
      )}

      {p.error && (
        <div className="notice bad">
          <strong>{tr(locale, 'خطأ', 'Error')}:</strong> <span className="ltr mono small" style={{ whiteSpace: 'pre-wrap' }}>{p.error.slice(0, 1200)}</span>
          {write && !active && (
            <form action={`/api/os/montage/${p.id}`} method="post" style={{ marginTop: 10 }}>
              <input type="hidden" name="action" value="reanalyze" />
              <button className="btn btn-sm">{tr(locale, 'إعادة التحليل', 'Analyze again')}</button>
            </form>
          )}
        </div>
      )}

      {stats && (
        <StatsRow>
          <Stat value={<span className="ltr">{fmtClock(stats.input)}</span>} label={tr(locale, 'مدة التسجيل', 'Recorded')} />
          <Stat value={<span className="ltr">{fmtClock(stats.output)}</span>} label={tr(locale, 'بعد المونتاج', 'After the edit')} />
          <Stat value={<span className="ltr">−{fmtClock(stats.removed)}</span>} label={tr(locale, `${Object.values(stats.byKind).reduce((n, k) => n + k.count, 0)} قص مفعّل`, 'removed')} />
          <Stat value={usd(p.cost_usd)} label={tr(locale, 'تكلفة الوكيل', 'Agent cost')} />
        </StatsRow>
      )}

      {d.renders.length > 0 && (
        <Card title={tr(locale, 'الملفات الجاهزة', 'Rendered files')}>
          <p className="small faint" style={{ marginBottom: 12 }}>{tr(locale, 'نسخة أولى آلية للمراجعة — لا شيء يُنشر من هنا. شاهد كل ملف قبل الرفع.', 'An automatic first cut for review — nothing is published from here. Watch every file before uploading.')}</p>
          <div className="montage-results">
            {d.renders.map((r) => (
              <div key={r.id} className={`montage-result ${r.kind}`}>
                {r.status === 'done' && r.asset_id ? (
                  <video src={`/api/os/media/${r.asset_id}`} poster={r.thumbnail_asset_id ? `/api/os/media/${r.thumbnail_asset_id}` : undefined} controls preload="none" playsInline />
                ) : (
                  <div className="montage-placeholder"><StatusBadge status={r.status === 'rendering' ? 'running' : r.status} locale={locale} /></div>
                )}
                <div className="stack" style={{ gap: 4 }}>
                  <strong className="small">{r.title || r.name}</strong>
                  <span className="small faint ltr">{r.duration_s ? fmtClock(r.duration_s) : ''} {mb(r.size)}</span>
                  {r.error && <span className="small" style={{ color: 'var(--bad)' }}>{r.error.slice(0, 200)}</span>}
                  {r.status === 'done' && r.asset_id && <a className="btn btn-sm" href={`/api/os/media/${r.asset_id}?download=1`}>{tr(locale, 'تنزيل', 'Download')}</a>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.plan && (
        <div className="grid-2">
          <Card title={tr(locale, 'ملخص الوكيل وملاحظاته', 'Agent summary & notes')}>
            {p.plan.summary ? <p className="small">{p.plan.summary}</p> : null}
            {p.plan.notes.length > 0 && <ul className="small" style={{ paddingInlineStart: 18, margin: '8px 0' }}>{p.plan.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            {!p.plan.agent.ran && (
              <p className="small faint">
                {p.transcript?.cues.length
                  ? tr(locale, `لم يعمل الوكيل: ${p.plan.agent.error ?? ''}`, `The agent did not run: ${p.plan.agent.error ?? ''}`)
                  : tr(locale, 'بدون تفريغ نصي: تم قص الصمت فقط، ولا توجد فصول أو مقاطع قصيرة.', 'No transcript: silences only, no chapters or shorts.')}
              </p>
            )}
            {write && p.transcript?.cues.length ? (
              <form action={`/api/os/montage/${p.id}`} method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="action" value="replan" />
                <button className="btn btn-sm btn-ghost" disabled={active}>{tr(locale, 'اطلب خطة جديدة من الوكيل', 'Ask the agent for a new plan')}</button>
              </form>
            ) : null}
          </Card>
          <Card title={tr(locale, 'تصدير', 'Export')}>
            <div className="list small">
              <a href={`/api/os/montage/${p.id}/export?f=chapters`}>{tr(locale, 'فصول يوتيوب (بعد القص)', 'YouTube chapters (edited timeline)')}{chapters && !chapters.valid ? ` — ${tr(locale, 'تحتاج 3 فصول على الأقل', 'needs 3+ chapters')}` : ''}</a>
              {p.transcript?.cues.length ? <a href={`/api/os/montage/${p.id}/export?f=srt`}>{tr(locale, 'ترجمة SRT للحلقة بعد القص', 'SRT for the edited episode')}</a> : null}
              {p.transcript?.cues.length ? <a href={`/api/os/montage/${p.id}/export?f=source-srt`}>{tr(locale, 'التفريغ الكامل (SRT الأصلي)', 'Full transcript (source SRT)')}</a> : null}
              <a href={`/api/os/montage/${p.id}/export?f=cuts`}>{tr(locale, 'قائمة القصّات (CSV) لبرامج المونتاج', 'Cut list (CSV) for editing software')}</a>
              {src && <a href={`/api/os/media/${src.id}?download=1`}>{tr(locale, 'الملف الأصلي', 'Original file')} <span className="faint">({mb(src.size)})</span></a>}
            </div>
          </Card>
        </div>
      )}

      {p.plan && src && (
        <MontageReview
          key={p.updated_at.toISOString()}
          projectId={p.id}
          plan={p.plan}
          sourceUrl={`/api/os/media/${src.id}`}
          sourceIsAudio={src.mime.startsWith('audio/')}
          canWrite={write && (p.status === 'review' || p.status === 'done' || p.status === 'failed')}
          locale={locale}
        />
      )}

      <Card>
        <div className="spread small faint" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>{src?.name} · {tr(locale, 'أُنشئ', 'Created')} {formatDate(locale, p.created_at, true)} · {tr(locale, 'التفريغ', 'Transcript')}: {p.transcript?.engine ?? p.transcript_source}{p.transcript?.cues.length ? ` (${p.transcript.cues.length})` : ''}</span>
          {can(session.role, 'media.delete') && !active && (
            <form action={`/api/os/montage/${p.id}`} method="post">
              <input type="hidden" name="action" value="delete" />
              <ConfirmSubmit message={tr(locale, 'حذف المشروع والملف الأصلي وكل الملفات المُخرجة نهائيًا؟', 'Permanently delete the project, the original and every render?')} className="btn btn-sm btn-danger">{tr(locale, 'حذف', 'Delete')}</ConfirmSubmit>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
