import { env } from '@/lib/env';
import { system } from '@/lib/db';
import s from './site.module.css';

export const dynamic = 'force-dynamic';

interface PublishedEpisode {
  title: string;
  topic: string;
  publish_at: Date | null;
  publish_links: { platform?: string; url?: string }[];
}

/** Only episodes the founder has approved AND marked published ever appear here. */
async function publishedEpisodes(): Promise<PublishedEpisode[]> {
  try {
    return await system((q) =>
      q.query<PublishedEpisode>(
        `select e.title, e.topic, e.publish_at, e.publish_links
           from ward.episodes e join ward.organizations o on o.id = e.org_id
          where o.slug = $1 and e.status = 'published' and e.approval_status = 'approved'
          order by e.publish_at desc nulls last limit 12`,
        [env().WARD_ORG_SLUG],
      ),
    );
  } catch {
    return []; // the public page never breaks because of the database
  }
}

const WEIGHTS = [
  { w: 300, name: 'Light' },
  { w: 400, name: 'Regular' },
  { w: 500, name: 'Medium' },
  { w: 700, name: 'Bold' },
  { w: 900, name: 'Black' },
];

export default async function Home() {
  const episodes = await publishedEpisodes();
  return (
    <main className={s.site} dir="rtl" lang="ar">
      <nav className={s.nav} aria-label="رئيسي">
        <span className={s.mark}>وارد</span>
        <div className={s.navLinks}>
          <a href="#about">من نحن</a>
          <a href="#content">المحتوى</a>
          <a href="#episodes">الحلقات</a>
          <a href="#partners">الشراكات</a>
        </div>
      </nav>

      <section className={s.hero}>
        <div>
          <h1 className={s.word}>وارد</h1>
          <p className={s.tagline}>كل شيء وارد.</p>
          <div className={s.rule} aria-hidden />
          <p className={s.soon}>قريبًا</p>
        </div>
      </section>

      <section id="about" className={s.section}>
        <p className={s.eyebrow}>من نحن</p>
        <h2 className={s.h2}>مساحة للحديث الذي يستحق أن يُسمع.</h2>
        <p className={s.lead}>
          وارد مشروع إعلامي سعودي في مرحلة التأسيس، يهدف إلى تقديم محتوى حواري قريب من الناس، يفتح المجال للأفكار المختلفة والتجارب التي
          تستحق المشاركة.
        </p>
        <div className={s.cols}>
          <div className={s.col}>
            <h3 className={s.colTitle}>رؤيتنا</h3>
            <p className={s.colText}>بناء علامة إعلامية مستقلة ذات حضور سعودي، تتوسع تدريجيًا من البودكاست إلى القصص والمحتوى الرقمي.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>شخصيتنا</h3>
            <p className={s.colText}>فضول، بساطة، احترام للاختلاف، وحوار طبيعي بعيد عن التكلف.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>جمهورنا</h3>
            <p className={s.colText}>السعودية والخليج: جمهور عربي مهتم بالحوارات والقصص والثقافة والتجارب الجديدة.</p>
          </div>
        </div>
      </section>

      <section id="content" className={s.section}>
        <p className={s.eyebrow}>المحتوى</p>
        <h2 className={s.h2}>محتوى يتجاوز حدود الحلقة.</h2>
        <div className={s.cols}>
          <div className={s.col}>
            <h3 className={s.colTitle}>بودكاست وارد</h3>
            <p className={s.colText}>حوارات عن التجارب الشخصية، الطموح، الثقافة، الحياة والعمل.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>مقاطع قصيرة</h3>
            <p className={s.colText}>لحظات منتقاة من الحلقات للنشر عبر المنصات الاجتماعية.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>قصص ومقالات</h3>
            <p className={s.colText}>امتداد تحريري للموقع الإلكتروني عند جاهزيته.</p>
          </div>
        </div>
        <p className={s.note}>قنوات النشر المخطط لها: يوتيوب، منصات البودكاست، إنستغرام، تيك توك، والموقع الرسمي.</p>
      </section>

      <section id="episodes" className={s.section}>
        <p className={s.eyebrow}>الحلقات</p>
        <h2 className={s.h2}>{episodes.length ? 'أحدث الحلقات' : 'الحلقة الأولى قريبًا.'}</h2>
        {episodes.length > 0 && (
          <div className={s.episodes}>
            {episodes.map((e) => {
              const link = e.publish_links.find((l) => l.url)?.url;
              return (
                <article key={e.title} className={s.episode}>
                  <div>
                    <h3 className={s.episodeTitle}>{e.title}</h3>
                    <p className={s.colText}>{e.topic}</p>
                  </div>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className={s.colText}>
                      شاهد ↗
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="partners" className={s.section}>
        <p className={s.eyebrow}>فرص الشراكة</p>
        <h2 className={s.h2}>شراكات تتناسب مع شخصية وارد.</h2>
        <div className={s.cols}>
          <div className={s.col}>
            <h3 className={s.colTitle}>راعي الحلقة</h3>
            <p className={s.colText}>ذكر اسم الراعي في الحلقة باتفاق مسبق، ورابطه في الوصف، وظهور بصري في المادة المنشورة.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>شريك المحتوى</h3>
            <p className={s.colText}>رعاية مجموعة حلقات أو مقاطع مختارة، مع ملخص أداء وفق البيانات المتاحة.</p>
          </div>
          <div className={s.col}>
            <h3 className={s.colTitle}>شريك التأسيس</h3>
            <p className={s.colText}>تعاون ممتد خلال مرحلة الإطلاق، بخطة تعاون خاصة تُحدد قبل التعاقد.</p>
          </div>
        </div>
        <p className={s.note}>
          لا توجد ضمانات مسبقة لعدد المشاهدات. تُعرّف المواد الإعلانية بوضوح مع الحفاظ على استقلالية المحتوى التحريري. تُضاف بيانات التواصل
          الرسمية بعد اعتمادها.
        </p>
      </section>

      <section className={s.section} aria-labelledby="type">
        <p className={s.eyebrow} id="type">
          WARD TYPE
        </p>
        <h2 className={s.h2}>خط أصلي صُمم لوارد.</h2>
        <div className={s.specimen}>
          {WEIGHTS.map((w) => (
            <div key={w.w} className={s.specimenRow} style={{ fontWeight: w.w }}>
              <span>كل شيء وارد</span>
              <span className={s.specimenMeta}>
                {w.name} · {w.w}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className={s.footer}>
        <span>© {new Date().getFullYear()} وارد</span>
        <span>كل شيء وارد.</span>
      </footer>
    </main>
  );
}
