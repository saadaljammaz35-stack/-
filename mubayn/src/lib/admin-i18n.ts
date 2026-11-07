import type { Locale } from "./i18n";

/** Admin console strings. Arabic first; the console follows the site language. */
const D = {
  // nav
  nav_overview: ["نظرة عامة", "Overview"],
  nav_inspections: ["الفحوصات", "Inspections"],
  nav_jobs: ["مهام التحليل", "AI jobs"],
  nav_customers: ["العملاء", "Customers"],
  nav_errors: ["الأخطاء", "Errors"],
  nav_messages: ["الرسائل", "Messages"],
  nav_limits: ["الحدود والتكلفة", "Limits"],
  nav_audit: ["سجل التدقيق", "Audit log"],

  // overview
  t_overview: ["نظرة عامة", "Overview"],
  k_customers: ["العملاء", "Customers"],
  k_verified: ["مؤكدون", "verified"],
  k_new7: ["جدد خلال 7 أيام", "new in 7 days"],
  k_reports: ["تقارير مكتملة", "Reports completed"],
  k_in_progress: ["قيد التنفيذ", "in progress"],
  k_failed: ["فشلت", "failed"],
  k_jobs: ["مهام التحليل", "AI jobs"],
  k_queued_running: ["في الانتظار أو قيد التشغيل", "queued/running"],
  k_failed_dead: ["فاشلة أو متوقفة", "failed/dead"],
  k_spend: ["تكلفة الذكاء الاصطناعي", "AI spend"],
  k_today: ["اليوم", "today"],
  k_7d: ["7 أيام", "7d"],
  k_30d: ["30 يوماً", "30d"],
  k_time: ["زمن إصدار التقرير", "Time to report"],
  k_median: ["الوسيط", "median"],
  k_attention: ["تحتاج انتباهك", "Needs attention"],
  k_errors: ["أخطاء", "errors"],
  k_messages: ["رسائل", "messages"],
  h_last14: ["آخر 14 يوماً", "Last 14 days"],
  c_day: ["اليوم (UTC)", "Day (UTC)"],
  c_submitted: ["مُرسلة", "Submitted"],
  c_completed: ["مكتملة", "Completed"],
  c_failed_jobs: ["مهام فاشلة", "Failed jobs"],
  c_cost: ["التكلفة", "AI cost"],
  fail_rate: ["نسبة فشل المحاولات (30 يوماً)", "Attempt failure rate (30 days)"],
  of_attempts: ["من أصل", "of"],
  attempts_word: ["محاولة", "attempts"],
  daily_cap: ["السقف اليومي", "Daily cap"],
  submissions: ["فحصاً", "submissions"],
  per_user_month: ["لكل عميل شهرياً", "per user per month"],
  h_readiness: ["جاهزية الإطلاق", "Launch readiness"],

  // customers
  t_customers: ["العملاء", "Customers"],
  search_ph: ["ابحث بالبريد أو الاسم", "Search e-mail or name"],
  search: ["بحث", "Search"],
  c_customer: ["العميل", "Customer"],
  c_status: ["الحالة", "Status"],
  c_verified: ["البريد مؤكد", "Verified"],
  c_inspections: ["الفحوصات", "Inspections"],
  c_reports: ["التقارير", "Reports"],
  c_joined: ["تاريخ التسجيل", "Joined"],
  yes: ["نعم", "yes"],
  no: ["لا", "no"],
  failed_logins: ["محاولات دخول فاشلة", "failed logins"],
  locked_until: ["مقفل حتى", "locked until"],
  disable_account: ["إيقاف الحساب", "Disable account"],
  disable_confirm: ["إيقاف هذا الحساب وتسجيل خروجه من كل الأجهزة؟", "Disable this account and sign it out everywhere?"],
  enable_account: ["إعادة تفعيل الحساب", "Re-enable account"],
  revoke_sessions: ["تسجيل خروج من كل الأجهزة", "Sign out all sessions"],
  revoke_confirm: ["تسجيل خروج هذا العميل من كل الأجهزة؟", "Sign this customer out everywhere?"],
  h_sessions: ["الجلسات", "Sessions"],
  h_emails: ["الرسائل البريدية", "E-mails"],
  last_seen: ["آخر نشاط", "last"],
  s_revoked: ["ملغاة", "revoked"],
  s_expired: ["منتهية", "expired"],
  s_active_session: ["نشطة", "active"],

  // inspections
  t_inspections: ["الفحوصات", "Inspections"],
  all: ["الكل", "all"],
  not_reviewed: ["تقارير لم تُراجع", "reports not reviewed"],
  c_device: ["الجهاز", "Device"],
  c_score: ["الدرجة", "Score"],
  c_reviewed: ["مراجَع", "Reviewed"],
  review: ["راجِع", "review"],
  seller_claims: ["ادعاءات البائع", "Seller claims"],
  created: ["أُنشئ", "created"],
  submitted: ["أُرسل", "submitted"],
  completed: ["اكتمل", "completed"],
  context: ["السياق", "context"],
  report_lang: ["لغة التقرير", "report"],
  retry_analysis: ["إعادة التحليل", "Retry analysis"],
  reanalyze: ["إعادة تحليل (إصدار جديد للتقرير)", "Re-analyse (new report version)"],
  reanalyze_confirm: ["سيُجرى تحليل جديد مدفوع ويُنشر إصدار جديد من التقرير. متابعة؟", "This runs a new paid AI analysis and publishes a new version. Continue?"],
  h_reports: ["التقارير", "Reports"],
  no_report: ["لا يوجد تقرير. التقرير يُنشأ فقط عند نجاح التحليل.", "No report. A report exists only when an analysis succeeded."],
  reviewed_at: ["رُوجع", "reviewed"],
  not_reviewed_short: ["لم يُراجع", "not reviewed"],
  h_attempts: ["محاولات التحليل", "Analysis attempts"],
  c_outcome: ["النتيجة", "Outcome"],
  c_model: ["النموذج", "Model"],
  c_tokens: ["التوكنز دخول/خروج", "Tokens in/out"],
  c_error: ["الخطأ", "Error"],
  c_request: ["رقم الطلب", "Request id"],
  c_started: ["البداية", "Started"],
  h_jobs: ["المهام", "Jobs"],
  attempts_n: ["المحاولات", "attempts"],
  next_run: ["التشغيل التالي", "next"],
  h_evidence: ["الأدلة", "Evidence"],

  // report review
  t_report_review: ["مراجعة التقرير", "Report review"],
  back_inspection: ["← الفحص", "← inspection"],
  note: ["ملاحظة", "note"],
  dropped: ["ملاحظات حُذفت لعدم وجود دليل صالح", "dropped findings (no valid evidence)"],
  mark_reviewed: ["تمت المراجعة", "Mark reviewed"],
  withdraw: ["سحب التقرير", "Withdraw report"],
  note_required: ["اكتب سبب السحب (مطلوب)", "Note (required)"],
  note_optional: ["ملاحظة (اختيارية)", "Note (optional)"],

  // jobs
  t_jobs: ["مراقبة التحليل", "AI processing"],
  jobs_intro: [
    "تبدأ المهام فور إرسال الفحص، وتُستأنف عند متابعة العميل لصفحة الحالة، ومرة يومياً من المجدوِل. المهمة التي تتوقف 10 دقائق تُعاد تلقائياً. التحليل الفاشل لا يُنتج تقريراً أبداً.",
    "Jobs start right after submission, resume while the customer watches the status page, and run daily from the scheduler. A job stuck for 10 minutes is retried. Failed analyses never produce a report.",
  ],
  failures_7d: ["أسباب الفشل (7 أيام)", "Failures (7 days)"],
  c_inspection: ["الفحص", "Inspection"],
  c_trigger: ["المصدر", "Trigger"],
  c_attempts: ["المحاولات", "Attempts"],
  c_last_error: ["آخر خطأ", "Last error"],
  c_next_run: ["التشغيل التالي", "Next run"],
  c_created: ["أُنشئت", "Created"],
  since: ["منذ", "since"],

  // errors
  t_errors: ["أخطاء التطبيق", "Application errors"],
  errors_intro: ["أخطاء غير متوقعة مجمّعة حسب السبب. وضع علامة «تم الحل» يخفيها حتى تتكرر.", "Unexpected errors grouped by cause. Marking one resolved hides it until it happens again."],
  show_open: ["المفتوحة فقط", "Show open only"],
  show_all: ["إظهار المحلولة أيضاً", "Show resolved too"],
  no_errors: ["لا توجد أخطاء مفتوحة.", "No open errors."],
  last: ["آخرها", "last"],
  resolved: ["محلول", "resolved"],
  mark_resolved: ["تم الحل", "Mark resolved"],

  // messages
  t_messages: ["رسائل التواصل", "Contact messages"],
  no_messages: ["لا توجد رسائل.", "No messages."],
  close: ["إغلاق", "Close"],
  m_open: ["مفتوحة", "open"],
  m_closed: ["مغلقة", "closed"],

  // limits
  t_limits: ["الحدود والتكلفة", "Limits and cost control"],
  limits_intro: [
    "الخدمة مجانية للعملاء، وAnthropic تحاسبك على كل تحليل. هذه الحدود هي أداتك للتحكم في الإنفاق. النموذج الحالي:",
    "The service is free to customers. Each analysis is billed to you by Anthropic, so these limits are your spending controls. Current model:",
  ],
  limits_watch: ["تابع الإنفاق الفعلي في صفحة «نظرة عامة».", "Watch actual spend on the Overview page."],
  l_monthly: ["فحوصات مجانية لكل عميل شهرياً", "Free inspections per user per month"],
  l_monthly_hint: ["صفر يوقف الإرسال للجميع", "0 stops new submissions for everyone"],
  l_daily: ["أقصى عدد فحوصات يومياً (لكل العملاء)", "Max submissions per day (all users)"],
  l_daily_hint: ["يحدّ من إنفاقك اليومي على الذكاء الاصطناعي", "Caps your daily AI spend"],
  l_images: ["أقصى عدد صور للفحص", "Max photos per inspection"],
  l_images_hint: ["من 4 إلى 40", "4 to 40"],
  l_videos: ["أقصى عدد مقاطع فيديو للفحص", "Max videos per inspection"],
  l_videos_hint: ["من 0 إلى 3 (صفر يوقف الفيديو)", "0 to 3 (0 disables video)"],
  l_seconds: ["أقصى طول للفيديو (ثانية)", "Max video length (seconds)"],
  l_seconds_hint: ["من 5 إلى 180", "5 to 180"],
  l_signups: ["التسجيل مفتوح", "Sign-ups open"],
  l_submissions: ["استقبال الفحوصات مفتوح", "Submissions open"],
  saved: ["تم الحفظ", "Saved"],
  save_limits: ["حفظ الحدود", "Save limits"],

  // audit
  t_audit: ["سجل التدقيق", "Audit log"],
  audit_ph: ["تصفية حسب بداية الإجراء، مثل admin.", "Filter by action prefix, e.g. admin."],
  filter: ["تصفية", "Filter"],
  c_time: ["الوقت", "Time"],
  c_actor: ["المنفّذ", "Actor"],
  c_action: ["الإجراء", "Action"],
  c_target: ["الهدف", "Target"],
  c_details: ["التفاصيل", "Details"],
  system: ["النظام", "system"],

  // mfa
  t_mfa: ["التحقق الثنائي", "Two-factor verification"],
  mfa_intro: ["لوحة الإدارة تتطلب رمزاً من تطبيق المصادقة في كل تسجيل دخول.", "The admin area requires an authenticator code on every sign-in."],
  mfa_setup: ["إعداد تطبيق المصادقة", "Set up authenticator app"],
  mfa_scan: [
    "امسح الرمز بتطبيق مصادقة (Google Authenticator أو 1Password أو Authy)، أو أدخل المفتاح يدوياً في التطبيق.",
    "Scan with an authenticator app (Google Authenticator, 1Password, Authy), or enter the key manually.",
  ],
  mfa_code: ["الرمز المكوّن من 6 أرقام", "6-digit code"],
  mfa_verify: ["تحقق", "Verify"],
} as const;

export type AKey = keyof typeof D;

export function adminT(locale: Locale) {
  const i = locale === "ar" ? 0 : 1;
  return (k: AKey) => D[k][i];
}

const JOB: Record<string, [string, string]> = {
  queued: ["في الانتظار", "queued"],
  running: ["قيد التشغيل", "running"],
  succeeded: ["نجحت", "succeeded"],
  failed: ["فشلت", "failed"],
  dead: ["توقفت بعد كل المحاولات", "dead"],
  canceled: ["ملغاة", "canceled"],
};
const ATTEMPT: Record<string, [string, string]> = { running: ["قيد التشغيل", "running"], succeeded: ["نجحت", "succeeded"], failed: ["فشلت", "failed"] };
const TRIGGER: Record<string, [string, string]> = {
  submission: ["إرسال العميل", "submission"],
  customer_retry: ["إعادة من العميل", "customer retry"],
  admin_retry: ["إعادة من الإدارة", "admin retry"],
  admin_reanalyze: ["إعادة تحليل من الإدارة", "admin re-analysis"],
};
const USER: Record<string, [string, string]> = { active: ["نشط", "active"], disabled: ["موقوف", "disabled"], deleted: ["محذوف", "deleted"], admin: ["مدير", "admin"], customer: ["عميل", "customer"] };
const REPORT: Record<string, [string, string]> = { published: ["منشور", "published"], superseded: ["إصدار سابق", "superseded"], withdrawn: ["مسحوب", "withdrawn"] };
const CTX: Record<string, [string, string]> = { buying: ["يفكر في الشراء", "buying"], selling: ["يبيع", "selling"], owner: ["المالك", "owner"] };
const KIND: Record<string, [string, string]> = { image: ["صورة", "image"], video: ["فيديو", "video"], video_frame: ["لقطة فيديو", "video frame"] };

function pick(map: Record<string, [string, string]>, v: string, locale: Locale): string {
  const m = map[v];
  return m ? m[locale === "ar" ? 0 : 1] : v;
}
export const jobLabel = (v: string, l: Locale) => pick(JOB, v, l);
export const attemptLabel = (v: string, l: Locale) => pick(ATTEMPT, v, l);
export const triggerLabel = (v: string, l: Locale) => pick(TRIGGER, v, l);
export const userLabel = (v: string, l: Locale) => pick(USER, v, l);
export const reportStatusLabel = (v: string, l: Locale) => pick(REPORT, v, l);
export const contextLabel = (v: string, l: Locale) => pick(CTX, v, l);
export const kindLabel = (v: string, l: Locale) => pick(KIND, v, l);
