import type { ApiError } from "./api";

const MESSAGES: Record<string, [string, string]> = {
  unauthorized: ["لازم تدخل حسابك، أو البيانات غلط.", "Sign in required, or the details are incorrect."],
  forbidden: ["ما تقدر تسوي هذا.", "This action is not allowed."],
  not_found: ["مهوب موجود.", "Not found."],
  rate_limited: ["محاولات كثيرة. اصبر شوي وجرّب مرة ثانية.", "Too many attempts. Wait a little and try again."],
  locked: ["قفلنا الحساب شوي بسبب محاولات غلط كثيرة. جرّب بعد 15 دقيقة أو استرجع كلمة السر.", "Account temporarily locked after too many failed attempts. Try again in 15 minutes or reset your password."],
  validation_failed: ["فيه خانات غلط.", "Some fields are invalid."],
  invalid_token: ["الرابط ما يشتغل أو خلص وقته.", "This link is invalid or has expired."],
  signups_closed: ["التسجيل موقّف شوي.", "Sign-ups are paused for now."],
  heic_unsupported: ["صيغة HEIC ما تنفع. اختر JPEG (في الآيفون: الإعدادات › الكاميرا › التنسيقات › الأكثر توافقاً).", "HEIC is not supported. Use JPEG (iPhone: Settings › Camera › Formats › Most Compatible)."],
  type_unsupported: ["نقبل صور JPEG وPNG وWebP وفيديو MP4 وMOV وWebM بس.", "Only JPEG, PNG, WebP photos and MP4, MOV, WebM videos."],
  too_large: ["الملف أكبر من المسموح.", "The file is larger than allowed."],
  limit_reached: ["وصلت للحد الأعلى من الملفات في هالفحص.", "You reached the file limit for this inspection."],
  video_not_allowed: ["رفع الفيديو موقّف الحين.", "Video uploads are currently disabled."],
  evidence_rejected: ["رفضنا الملف بعد ما فحصناه.", "The file was rejected after checking it."],
  not_uploaded: ["الملف للحين ما وصل.", "The file did not reach storage yet."],
  locked_inspection: ["ما تقدر تعدّل الفحص بعد ما أرسلته.", "The inspection can't be changed after submission."],
  uploads_pending: ["اصبر إلين يخلص رفع كل الملفات.", "Wait for all uploads to finish."],
  not_enough_evidence: ["حط 4 صور على الأقل.", "Add at least 4 photos."],
  monthly_quota_reached: ["خلّصت فحوصاتك المجانية لهالشهر.", "You used all your free inspections for this month."],
  daily_capacity_reached: ["التحليل اليوم وصل حدّه. أرسل الفحص بكرة.", "Today's analysis capacity is full. Submit again tomorrow."],
  submissions_paused: ["استقبال الفحوصات موقّف شوي.", "New inspections are paused for now."],
  email_taken: ["فيه حساب بهالإيميل. ادخل منه بدال ما تسوي حساب جديد.", "An account with this e-mail already exists. Sign in instead."],
  invalid_recovery: ["الإيميل أو رمز الاسترجاع غلط.", "The e-mail or recovery code is incorrect."],
  email_disabled: ["حنا ما نرسل إيميلات. استخدم رمز الاسترجاع.", "This site does not send e-mail. Use your recovery code."],
  target_admin: ["لا يمكن إصدار رمز استعادة لحساب مدير من هنا.", "Recovery codes for admin accounts cannot be issued here."],
  analysis_unavailable: ["التحليل واقف شوي. حفظنا المسودة، جرّب بعدين.", "Analysis is temporarily unavailable. Your draft is saved; try again later."],
  already_submitted: ["هالفحص انرسل من قبل.", "This inspection was already submitted."],
  retry_limit: ["عدت المحاولة مرتين. كلّمنا من صفحة التواصل.", "Already retried twice. Please contact support."],
  too_many_drafts: ["عندك 10 مسودات. كمّل وحدة أو احذفها أول.", "You have 10 drafts. Finish or delete one first."],
  analysis_running: ["فيه تحليل شغّال. جرّب بعد دقايق.", "An analysis is running. Try again in a few minutes."],
  invalid_code: ["الرمز غلط.", "That code is not valid."],
  not_failed: ["لا يمكن إعادة المحاولة إلا لتحليل فاشل.", "Only a failed analysis can be retried."],
  not_completed: ["لا يمكن إعادة التحليل إلا لفحص مكتمل.", "Only completed inspections can be re-analysed."],
  job_running: ["يوجد تحليل في الانتظار أو قيد التشغيل لهذا الفحص.", "An analysis is already queued or running."],
  self: ["لا يمكنك تعديل حسابك من هنا.", "You cannot change your own account here."],
  already_enrolled: ["التحقق الثنائي مفعّل مسبقاً.", "Two-factor authentication is already set up."],
  mfa_not_started: ["ابدأ إعداد التحقق الثنائي أولاً.", "Start two-factor setup first."],
  admin_account: ["أزل صلاحية المدير قبل حذف هذا الحساب.", "Remove admin rights before deleting this account."],
  network: ["ما قدرنا نتصل. شيّك على النت.", "Network error. Check your connection."],
  internal: ["صار خطأ من عندنا وسجّلناه.", "Something went wrong on our side. It has been logged."],
};

export function errorText(e: ApiError, locale: "ar" | "en"): string {
  const code = e.code === "locked" && e.message.includes("edited") ? "locked_inspection" : e.code;
  const m = MESSAGES[code];
  if (!m) return locale === "en" ? e.message : `${e.message}`;
  // Rejection reasons from the server are specific; show them alongside.
  if (code === "evidence_rejected") return `${m[locale === "ar" ? 0 : 1]} (${e.message})`;
  return m[locale === "ar" ? 0 : 1];
}
