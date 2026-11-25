export type Locale = 'ar' | 'en';

export const LOCALE_COOKIE = 'ward_locale';
export const THEME_COOKIE = 'ward_theme';

const ar = {
  brand: 'وارد',
  os: 'WARD OS',
  tagline: 'كل شيء وارد.',
  nav: {
    dashboard: 'مركز القيادة', runs: 'أوامر التشغيل', agents: 'الفريق الذكي', meetings: 'غرفة الاجتماعات',
    knowledge: 'الذاكرة المؤسسية', episodes: 'الحلقات', sponsors: 'الرعايات', tasks: 'المهام', approvals: 'الموافقات',
    finance: 'المالية', automations: 'الأتمتة', settings: 'الإعدادات', audit: 'سجل التدقيق',
  },
  common: {
    save: 'حفظ', cancel: 'إلغاء', create: 'إنشاء', delete: 'حذف', edit: 'تعديل', open: 'فتح', back: 'رجوع', none: 'لا يوجد',
    status: 'الحالة', priority: 'الأولوية', due: 'الاستحقاق', owner: 'المسؤول', actions: 'إجراءات', search: 'بحث',
    signOut: 'تسجيل الخروج', theme: 'المظهر', language: 'English', collapse: 'طي القائمة', notSet: 'غير محدد',
    approve: 'موافقة', reject: 'رفض', retry: 'إعادة المحاولة', resume: 'استئناف', view: 'عرض', add: 'إضافة', all: 'الكل',
  },
  login: { title: 'دخول WARD OS', email: 'البريد الإلكتروني', password: 'كلمة المرور', submit: 'دخول', failed: 'بيانات الدخول غير صحيحة', limited: 'محاولات كثيرة، حاول لاحقًا' },
  dash: {
    greeting: 'غرفة القيادة', command: 'أمر للفريق', commandPlaceholder: 'مثال: جهّز الحلقة القادمة مع ضيف متخصص في ريادة الأعمال',
    send: 'أرسل للمدير التنفيذي', limit: 'سقف التكلفة (USD)', agentsState: 'حالة الوكلاء', current: 'التشغيل الحالي', completed: 'المكتمل مؤخرًا',
    approvals: 'موافقات معلقة', episodes: 'الحلقات القادمة', shoots: 'جدول التصوير', sponsors: 'حالة الرعايات', budget: 'الميزانية هذا الشهر',
    ai: 'تكلفة الذكاء الاصطناعي', alerts: 'التنبيهات', performance: 'تقارير الأداء', noProvider: 'لم يُعد أي مزود ذكاء اصطناعي بعد — الأوامر ستفشل بوضوح حتى تضيف مفتاح API.',
    paused: 'الوكلاء موقوفون بزر الإيقاف.',
  },
  kill: { stop: 'إيقاف جميع الوكلاء', resume: 'استئناف الوكلاء', confirm: 'سيتم إلغاء كل التشغيلات الجارية. متأكد؟' },
};

type Dict = typeof ar;

const en: Dict = {
  brand: 'WARD',
  os: 'WARD OS',
  tagline: 'Everything is possible.',
  nav: {
    dashboard: 'Command center', runs: 'Runs', agents: 'AI team', meetings: 'Meeting room', knowledge: 'Knowledge',
    episodes: 'Episodes', sponsors: 'Sponsors', tasks: 'Tasks', approvals: 'Approvals', finance: 'Finance',
    automations: 'Automations', settings: 'Settings', audit: 'Audit log',
  },
  common: {
    save: 'Save', cancel: 'Cancel', create: 'Create', delete: 'Delete', edit: 'Edit', open: 'Open', back: 'Back', none: 'None',
    status: 'Status', priority: 'Priority', due: 'Due', owner: 'Owner', actions: 'Actions', search: 'Search',
    signOut: 'Sign out', theme: 'Theme', language: 'العربية', collapse: 'Collapse sidebar', notSet: 'Not set',
    approve: 'Approve', reject: 'Reject', retry: 'Retry', resume: 'Resume', view: 'View', add: 'Add', all: 'All',
  },
  login: { title: 'Sign in to WARD OS', email: 'Email', password: 'Password', submit: 'Sign in', failed: 'Invalid credentials', limited: 'Too many attempts, try later' },
  dash: {
    greeting: 'Command center', command: 'Command the team', commandPlaceholder: 'e.g. Prepare the next episode with an entrepreneurship guest',
    send: 'Send to WARD Chief', limit: 'Cost limit (USD)', agentsState: 'Agents', current: 'Active runs', completed: 'Recently completed',
    approvals: 'Pending approvals', episodes: 'Upcoming episodes', shoots: 'Shooting schedule', sponsors: 'Sponsorships', budget: 'Budget this month',
    ai: 'AI spend', alerts: 'Alerts', performance: 'Performance reports', noProvider: 'No AI provider configured yet — commands will fail clearly until you add an API key.',
    paused: 'Agents are stopped by the kill switch.',
  },
  kill: { stop: 'Stop all agents', resume: 'Resume agents', confirm: 'All active runs will be cancelled. Continue?' },
};

export const DICTS: Record<Locale, Dict> = { ar, en };

export function dict(locale: Locale): Dict {
  return DICTS[locale];
}

/** Labels for enum values shown in the UI. Unknown values fall back to the raw value. */
const LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    queued: 'في الطابور', planning: 'تخطيط', running: 'قيد التنفيذ', reviewing: 'مراجعة', awaiting_approval: 'بانتظار الموافقة',
    completed: 'مكتمل', failed: 'فشل', cancelled: 'ملغى', pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض', executed: 'نُفذ',
    idle: 'متاح', working: 'يعمل', paused: 'موقوف', disabled: 'معطل',
    idea: 'فكرة', research: 'بحث', preparation: 'إعداد', guest_confirmation: 'تأكيد الضيف', ready_to_shoot: 'جاهزة للتصوير',
    shooting: 'تصوير', editing: 'مونتاج', review: 'مراجعة', ready_to_publish: 'جاهزة للنشر', published: 'منشورة',
    draft: 'مسودة', pending_verification: 'بانتظار التحقق', in_discussion: 'قيد النقاش', verified: 'موثق', active: 'نشط', ended: 'منتهٍ', declined: 'اعتذر',
    backlog: 'لاحقًا', todo: 'للتنفيذ', in_progress: 'جارٍ', done: 'منجز', blocked: 'معطل',
    low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة',
    proposed: 'مقترح', contacted: 'تم التواصل', interested: 'مهتم', confirmed: 'مؤكد', superseded: 'مستبدل',
    publish_content: 'نشر محتوى', send_external_message: 'مراسلة خارجية', sign_agreement: 'قبول/توقيع اتفاقية', spend_money: 'صرف أموال',
    delete_data: 'حذف بيانات', modify_live_site: 'تعديل الموقع المنشور', share_private_file: 'مشاركة ملف خاص', change_permissions: 'تغيير صلاحيات',
    pending_approval: 'بانتظار الموافقة', paid: 'مدفوع', expected: 'متوقع', received: 'مستلم',
    owner: 'المؤسس', admin: 'مدير', editor: 'محرر', viewer: 'مشاهد',
    morning_report: 'التقرير الصباحي', weekly_report: 'التقرير الأسبوعي', shoot_schedule_review: 'مراجعة مواعيد التصوير',
    sponsor_rights_followup: 'متابعة حقوق الرعاة', episode_ideas: 'اقتراح أفكار حلقات', expense_review: 'مراجعة المصاريف',
    deadline_alerts: 'تنبيه المواعيد', error_monitor: 'مراقبة الأخطاء',
    identity: 'الهوية', goals: 'الأهداف', decisions: 'القرارات', episodes: 'الحلقات', guests: 'الضيوف', sponsorships: 'الرعايات',
    marketing: 'التسويق', meetings: 'الاجتماعات', files: 'الملفات', budget: 'الميزانية', policies: 'السياسات', reports: 'التقارير',
  },
  en: {},
};

export function label(locale: Locale, value: string | null | undefined): string {
  if (!value) return '—';
  return LABELS[locale][value] ?? value.replace(/_/g, ' ');
}

export function formatDate(locale: Locale, value: Date | string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function money(value: unknown, currency = 'SAR'): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

export function usd(value: unknown): string {
  const n = Number(value ?? 0);
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Inline bilingual text for one-off strings: tr(locale, 'عربي', 'English'). */
export function tr(locale: Locale, ar: string, en: string): string {
  return locale === 'ar' ? ar : en;
}
