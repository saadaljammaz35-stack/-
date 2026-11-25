import { system, type OrgContext, type Queryable } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { AGENTS } from '@/lib/agents/definitions';
import { AUTOMATION_DEFAULTS, AUTOMATION_KINDS } from '@/lib/automations';
import { configuredProviders } from '@/lib/ai/gateway';
import { PROVIDERS } from '@/lib/settings';
import { createDocument, type KnowledgeCategory } from '@/lib/knowledge';

/**
 * Idempotent seed. Everything here comes from WARD's own documents (brand guidelines,
 * media kit, operations manual) or from the founder's brief. Nothing is invented:
 * sponsors have no amounts or dates, the first guest is a proposal, budgets are empty.
 */

export const SPONSOR_NAMES = ['سهم', 'سماط', 'OMNIX', 'مداد', 'محلّك', 'مُبيّن', 'دوري', 'CliniBot', 'RAVENX', 'مع الله'] as const;
export const PENDING_SPONSOR_NAME = 'علامة إضافية — بانتظار تحديد الاسم';

const FIRST_EPISODE = {
  title: 'أكبر من عمره',
  topic: 'المشاريع وصناعة المحتوى بعمر صغير',
  guest: 'صاحب قناة باب مشوي',
  channel: 'باب مشوي',
};

const DOCS: { title: string; category: KnowledgeCategory; content: string }[] = [
  {
    title: 'هوية وارد',
    category: 'identity',
    content: `الاسم: وارد (WARD). الشعار: «كل شيء وارد.»
وارد مشروع إعلامي سعودي في مرحلة التأسيس (نسخة ما قبل الإطلاق)، منصة إعلامية سعودية ناشئة للحوارات والقصص والأفكار. يهدف إلى تقديم محتوى حواري قريب من الناس، يفتح المجال للأفكار المختلفة والتجارب التي تستحق المشاركة: «مساحة للحديث الذي يستحق أن يُسمع».
المهمة (من دليل التشغيل): حوارات وقصص سعودية بروح فضولية ومستقلة.
الرؤية: بناء علامة إعلامية مستقلة ذات حضور سعودي، تتوسع تدريجيًا من البودكاست إلى القصص والمحتوى الرقمي.
الشخصية: فضول، بساطة، احترام للاختلاف، وحوار طبيعي بعيد عن التكلف.

الألوان الرسمية: Charcoal ‎#171717، Ivory ‎#F2EFE8، Gray ‎#858585، Sand ‎#C3A77A (لون مميز يُستخدم باعتدال).
الخطوط: WARD TYPE للعناوين والهوية (خط أصلي مصمم لوارد، خمسة أوزان: 300، 400، 500، 700، 900). للنصوص الطويلة: IBM Plex Sans Arabic أو Tajawal.`,
  },
  {
    title: 'المحتوى والجمهور وقنوات النشر',
    category: 'marketing',
    content: `مسارات المحتوى المقترحة:
- بودكاست وارد: حوارات عن التجارب الشخصية، الطموح، الثقافة، الحياة والعمل.
- مقاطع قصيرة: لحظات منتقاة من الحلقات للنشر عبر المنصات الاجتماعية.
- قصص ومقالات: امتداد تحريري للموقع الإلكتروني عند جاهزيته.
الجمهور المستهدف: السعودية والخليج؛ جمهور عربي مهتم بالحوارات والقصص والثقافة والتجارب الجديدة.
قنوات النشر المخطط لها: يوتيوب، منصات البودكاست، إنستغرام، تيك توك، والموقع الرسمي.
وتيرة الإنتاج المستهدفة: حلقة أسبوعية مع مقاطع قصيرة داعمة، بحسب جاهزية الإنتاج (دليل التشغيل يقترح البدء بحلقة كل أسبوعين).
تنبيه: جميع هذه المسارات أهداف تشغيلية مقترحة. لا تتوفر حاليًا أرقام موثقة للمشاهدات أو المتابعين أو معدلات التفاعل.`,
  },
  {
    title: 'السياسة التحريرية ومعيار الجاهزية للنشر',
    category: 'policies',
    content: `مبادئ المحتوى: الوضوح، احترام الضيف، التحقق من المعلومات، الفصل بين الرأي والحقيقة، وعدم المبالغة في العناوين. لا تنشر معلومات خاصة أو ادعاءات غير موثقة.
دورة إنتاج الحلقة: فكرة ← بحث ← إعداد ← تأكيد الضيف ← تصوير ← مونتاج ← مراجعة ← موافقة المؤسس ← نشر ← قياس الأداء.
معيار الجاهزية للنشر: سلامة الصوت والصورة، موافقة الضيف على التسجيل والنشر، تدقيق الأسماء والحقائق، حقوق الموسيقى والصور، مراجعة ظهور الرعاة، وتدقيق النص والعنوان والوصف.
التعامل مع الأخطاء: أوقف النشر عند ظهور خطأ أو شكوى جدية، احفظ الأدلة، راجع الواقعة، صحح المعلومة بشفافية، وأبلغ المعنيين عند الحاجة.`,
  },
  {
    title: 'الخصوصية وحماية الضيوف',
    category: 'policies',
    content: `لا تجمع إلا البيانات اللازمة. إذا كان الضيف قاصرًا، احصل على موافقة ولي أمره قبل التسجيل والنشر، وتجنب كشف معلوماته الحساسة أو موقعه الشخصي.
لا يُعلن موعد أو اسم ضيف قبل تأكيده.`,
  },
  {
    title: 'إدارة الفريق الذكي والموافقات الإلزامية',
    category: 'policies',
    content: `الوكلاء مساعدون للتنفيذ، وليسوا موظفين بشريين أو ممثلين قانونيين.
- الإدارة التنفيذية (Chief): توزيع المهام، جمع النتائج، تقرير الأولويات.
- المحتوى والإنتاج (Editorial / Production): البحث، الأسئلة، خطة التصوير، تعليمات المونتاج؛ التصوير الفعلي مسؤولية بشرية.
- التسويق والعلاقات (Marketing / Relations): مسودات المنشورات والدعوات وجدولة مقترحة؛ لا إرسال خارجي دون موافقة.
- الرعايات والمالية (Business / Finance): سجل الشركاء، عروض الرعاية، تتبع المستحقات والتكاليف؛ لا توقيع أو دفع.
- التقنية والجودة (Tech / Review): فحص الأعطال والمصادر، مراجعة المخرجات، اقتراح الإصلاحات دون نشر تغييرات تلقائية.
الموافقات الإلزامية: المؤسس أو المسؤول المخول يعتمد النشر والمراسلات والصرف والعقود وحذف البيانات وتعديل الصلاحيات. حدد سقف تكلفة لكل مهمة، وأوقف التشغيل عند تجاوزه. احتفظ بسجل تدقيق ومصادر لكل قرار.`,
  },
  {
    title: 'الرعايات والضوابط المالية',
    category: 'sponsorships',
    content: `حالة الشركاء: سهم، سماط، OMNIX، مداد، محلّك، مُبيّن، دوري، CliniBot، RAVENX، مع الله، وعلامة إضافية لم يُحدد اسمها. القائمة أولية؛ يجب توثيق موافقة كل علامة وفئة الرعاية ومقابلها قبل الإعلان. لا توجد حتى الآن اتفاقيات أو مبالغ موثقة.
سجل الاتفاقيات يتضمن: اسم الشريك، بيانات التواصل، مدة الاتفاق، المقابل النقدي أو العيني، حقوق الظهور، موافقة استخدام الشعار، تاريخ الاستحقاق، وإثبات التنفيذ. لا تُحسب الرعاية العينية كدخل نقدي.
ضوابط مالية: حدد ميزانية الحلقة مسبقًا. سجل كل مصروف وإيراد مع الإثبات، واعتمد الصرف قبل الالتزام. راجع النقد المتاح وتكلفة الذكاء الاصطناعي أسبوعيًا. لا تخترع أرقام جمهور أو إيرادات.
التأسيس النظامي: قبل النشر التجاري، تحقق من التسجيل والتراخيص والإفصاح الإعلاني لدى الجهات المختصة. يتولى ولي الأمر أو الممثل المخول الإجراءات والتوقيع إذا كان المؤسس قاصرًا. هذه السياسة ليست استشارة قانونية.`,
  },
  {
    title: 'صيغ الشراكة المقترحة في الملف الإعلامي',
    category: 'sponsorships',
    content: `نقترح ثلاث صيغ للتعاون تُخصص وفق أهداف الشريك وطبيعة المحتوى والقدرة الإنتاجية:
1. راعي الحلقة: ذكر اسم الراعي في الحلقة باتفاق مسبق، إدراج رابط الراعي في الوصف عند توفره، ظهور بصري في المادة المنشورة.
2. شريك المحتوى: رعاية مجموعة حلقات أو مقاطع مختارة، حضور متسق عبر المواد المتفق عليها، ملخص أداء بعد انتهاء الحملة وفق البيانات المتاحة.
3. شريك التأسيس: تعاون ممتد خلال مرحلة الإطلاق، خطة تعاون خاصة تُحدد قبل التعاقد، فرص ظهور في محتوى الإطلاق المتفق عليه.
الأسعار وعدد المواد والمدة وحقوق الاستخدام تُحدد في عرض منفصل بعد الاتفاق. لا توجد ضمانات مسبقة لعدد المشاهدات. تُعرّف المواد الإعلانية بوضوح مع الحفاظ على استقلالية المحتوى التحريري.
آلية التعاون: (1) التعرف على أهداف الشريك والجمهور، (2) تحديد صيغة الرعاية والمخرجات والتكلفة، (3) اعتماد الاتفاق وجدول الإنتاج والنشر، (4) تسليم المواد وملخص الأداء الفعلي المتاح.
بيانات التواصل الرسمية ورابط الموقع تُضاف بعد اعتمادها. الملف الإعلامي نسخة تعريفية أولية للنقاش، وليس عرضًا تعاقديًا أو إعلانًا عن شراكات قائمة.`,
  },
  {
    title: 'خطة أول 90 يومًا ومؤشرات القياس',
    category: 'goals',
    content: `مراحل مقترحة تبدأ من تاريخ اعتماد دليل التشغيل، وليست مواعيد مؤكدة.
الأيام 1–14 (التجهيز): تأكيد الضيف، التحقق من الإجراءات النظامية والرعايات، اختبار الكاميرا والمايك، تجهيز المكان، تسجيل تجربة 10 دقائق، واعتماد الأسئلة. المخرج: حلقة جاهزة للتصوير.
الأيام 15–30 (الإطلاق): تصوير الحلقة الأولى، المونتاج والتدقيق، نشر الإعلان بعد التأكيد، ثم إطلاق الحلقة عبر القنوات الجاهزة. المخرج: حلقة واحدة ومقاطع قصيرة حقيقية.
الأيام 31–60 (الاستمرار): استهداف حلقة كل أسبوعين كبداية، مع مقطعين أو ثلاثة لكل حلقة. مراجعة التعليقات والاحتفاظ بالمشاهدين، وإعداد تقرير حقوق الرعاة. لا ترفع وتيرة الإنتاج على حساب الجودة.
الأيام 61–90 (التحسين): تحليل الأداء الفعلي، مراجعة الميزانية، اختبار موضوعات جديدة، تقييم الشركاء والوكلاء، واعتماد خطة الربع التالي بناء على النتائج.
مؤشرات القياس: الحلقات المنشورة، الالتزام بالمواعيد، دقائق المشاهدة، متوسط مدة المشاهدة، تكلفة الحلقة، النقد المتاح، ونسبة حقوق الرعاية المنفذة. سجل القيم الفعلية فقط.
أول مهمة: تأكيد استضافة باب مشوي وتحديد موعد تجريبي، ثم اختبار جودة التسجيل. لا تجعل اكتمال الموقع أو WARD OS شرطًا لتسجيل الحلقة.`,
  },
  {
    title: 'الحلقة الأولى: أكبر من عمره',
    category: 'episodes',
    content: `ضيف مقترح: صاحب قناة باب مشوي. الموضوع: المشاريع وصناعة المحتوى بعمر صغير (ريادة الأعمال وصناعة المحتوى في سن مبكرة). العنوان المقترح: أكبر من عمره.
الحالة: مسودة. الاستضافة غير مؤكدة إلا بعد موافقة المؤسس، ولا يُعلن موعد أو اسم ضيف قبل تأكيده. إذا كان الضيف قاصرًا فموافقة ولي الأمر مطلوبة قبل التسجيل والنشر.`,
  },
  {
    title: 'توزيع الاستوديو المقترح',
    category: 'episodes',
    content: `مخطط مقترح للاستوديو (تصور وليس موقع تصوير قائمًا):
- لافتة «وارد» في الخلفية بعرض المكان.
- المقدم على يسار المخطط والضيف على يمينه، والطاولة في المنتصف بينهما.
- إضاءتان في الزاويتين الأماميتين، كل منهما موجهة نحو أحد المتحدثين.
- كاميرا واحدة في المنتصف أمام الطاولة موجهة نحو المقدم والضيف.
لم تُحدد بعد: نوع الكاميرا والمايكات، عدد الكاميرات الإضافية، والمكان الفعلي.`,
  },
];

export interface SeedResult {
  orgId: string;
  founderId: string | null;
  created: string[];
}

async function ensureFounder(q: Queryable, orgId: string, founder: { email: string; password: string; name: string }): Promise<string> {
  const email = founder.email.trim().toLowerCase();
  const existing = (await q.query<{ id: string }>('select id from ward.users where email = $1', [email]))[0];
  const id = existing?.id ?? (await q.query<{ id: string }>(
    'insert into ward.users (email, name, password_hash) values ($1,$2,$3) returning id',
    [email, founder.name, await hashPassword(founder.password)],
  ))[0]!.id;
  await q.query(
    `insert into ward.organization_members (org_id, user_id, role) values ($1,$2,'owner') on conflict (org_id, user_id) do nothing`,
    [orgId, id],
  );
  return id;
}

export async function seed(opts: { orgSlug?: string; founder?: { email: string; password: string; name: string } | null } = {}): Promise<SeedResult> {
  const created: string[] = [];
  return system(async (q) => {
    const slug = opts.orgSlug ?? 'ward';
    await q.query(`insert into ward.organizations (slug, name) values ($1, 'WARD | وارد') on conflict (slug) do nothing`, [slug]);
    const orgId = (await q.query<{ id: string }>('select id from ward.organizations where slug = $1', [slug]))[0]!.id;
    const ctx: OrgContext = { orgId, userId: null, role: 'system' };

    const founderId = opts.founder ? await ensureFounder(q, orgId, opts.founder) : null;

    for (const a of AGENTS) {
      const inserted = await q.query<{ id: string }>(
        `insert into ward.ai_agents (org_id, slug, name, title_ar, title_en, description, instructions)
         values ($1,$2,$3,$4,$5,$6,'') on conflict (org_id, slug) do nothing returning id`,
        [orgId, a.slug, a.name, a.titleAr, a.titleEn, a.description],
      );
      if (inserted[0]) {
        created.push(`agent:${a.slug}`);
        await q.query(
          `insert into ward.agent_configs (agent_id, org_id, temperature, allowed_tools) values ($1,$2,$3,$4::text[])`,
          [inserted[0].id, orgId, a.temperature, `{${a.tools.join(',')}}`],
        );
      }
    }

    const live = new Set(configuredProviders());
    for (const p of PROVIDERS) {
      await q.query(
        `insert into ward.integrations (org_id, provider, status) values ($1,$2,$3)
         on conflict (org_id, provider) do update set status = excluded.status where ward.integrations.status in ('unknown','configured','missing')`,
        [orgId, p, live.has(p) ? 'configured' : 'missing'],
      );
    }

    for (const kind of AUTOMATION_KINDS) {
      const d = AUTOMATION_DEFAULTS[kind];
      const r = await q.query(
        `insert into ward.automations (org_id, kind, cron, uses_ai, max_cost_usd) values ($1,$2,$3,$4,$5) on conflict (org_id, kind) do nothing returning id`,
        [orgId, kind, d.cron, d.usesAi, d.maxCostUsd],
      );
      if (r.length) created.push(`automation:${kind}`);
    }

    let guestId = (await q.query<{ id: string }>('select id from ward.guests where org_id = $1 and name = $2', [orgId, FIRST_EPISODE.guest]))[0]?.id;
    if (!guestId) {
      guestId = (await q.query<{ id: string }>(
        `insert into ward.guests (org_id, name, channel, topics, status, notes)
         values ($1,$2,$3,$4::text[],'proposed',$5) returning id`,
        [orgId, FIRST_EPISODE.guest, FIRST_EPISODE.channel, '{"ريادة الأعمال","صناعة المحتوى"}', 'ضيف مقترح. لا تعتبر الاستضافة مؤكدة إلا بعد موافقة المؤسس. العمر وبيانات التواصل غير مسجلة.'],
      ))[0]!.id;
      created.push('guest:bab-mashwi');
    }
    if (!(await q.query('select 1 from ward.episodes where org_id = $1 and title = $2', [orgId, FIRST_EPISODE.title])).length) {
      await q.query(
        `insert into ward.episodes (org_id, number, title, topic, description, status, guest_id, guest_confirmed, approval_status)
         values ($1, 1, $2, $3, $4, 'idea', $5, false, 'draft')`,
        [orgId, FIRST_EPISODE.title, FIRST_EPISODE.topic, 'الحلقة الأولى من وارد (مسودة). الضيف مقترح وغير مؤكد.', guestId],
      );
      created.push('episode:1');
    }

    for (const name of [...SPONSOR_NAMES, PENDING_SPONSOR_NAME]) {
      if ((await q.query('select 1 from ward.sponsors where org_id = $1 and name = $2', [orgId, name])).length) continue;
      await q.query(
        `insert into ward.sponsors (org_id, name, name_pending, status, notes) values ($1,$2,$3,'pending_verification',$4)`,
        [orgId, name, name === PENDING_SPONSOR_NAME, 'بانتظار التحقق من الاتفاق. لا توجد فئة أو قيمة أو مدة موثقة.'],
      );
      created.push(`sponsor:${name}`);
    }

    for (const doc of DOCS) {
      if ((await q.query('select 1 from ward.knowledge_documents where org_id = $1 and title = $2', [orgId, doc.title])).length) continue;
      await createDocument(q, ctx, { ...doc, source: 'system', verified: true });
      created.push(`knowledge:${doc.title}`);
    }
    return { orgId, founderId, created };
  });
}
