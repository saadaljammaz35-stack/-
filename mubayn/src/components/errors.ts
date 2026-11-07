import type { ApiError } from "./api";

const MESSAGES: Record<string, [string, string]> = {
  unauthorized: ["يجب تسجيل الدخول، أو أن البيانات غير صحيحة.", "Sign in required, or the details are incorrect."],
  forbidden: ["غير مسموح بهذا الإجراء.", "This action is not allowed."],
  not_found: ["غير موجود.", "Not found."],
  rate_limited: ["محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.", "Too many attempts. Wait a little and try again."],
  locked: ["الحساب مقفل مؤقتاً بسبب محاولات خاطئة كثيرة. حاول بعد 15 دقيقة أو استعد كلمة المرور.", "Account temporarily locked after too many failed attempts. Try again in 15 minutes or reset your password."],
  validation_failed: ["بعض الحقول غير صحيحة.", "Some fields are invalid."],
  invalid_token: ["الرابط غير صالح أو انتهت مدته.", "This link is invalid or has expired."],
  signups_closed: ["التسجيل متوقف مؤقتاً.", "Sign-ups are paused for now."],
  heic_unsupported: ["صيغة HEIC غير مدعومة. اختر JPEG (في الآيفون: الإعدادات › الكاميرا › التنسيقات › الأكثر توافقاً).", "HEIC is not supported. Use JPEG (iPhone: Settings › Camera › Formats › Most Compatible)."],
  type_unsupported: ["نقبل صور JPEG وPNG وWebP وفيديو MP4 وMOV وWebM فقط.", "Only JPEG, PNG, WebP photos and MP4, MOV, WebM videos."],
  too_large: ["الملف أكبر من الحد المسموح.", "The file is larger than allowed."],
  limit_reached: ["وصلت للحد الأقصى لعدد الملفات في هذا الفحص.", "You reached the file limit for this inspection."],
  video_not_allowed: ["رفع الفيديو متوقف حالياً.", "Video uploads are currently disabled."],
  evidence_rejected: ["رُفض الملف بعد فحصه.", "The file was rejected after checking it."],
  not_uploaded: ["لم يصل الملف إلى التخزين بعد.", "The file did not reach storage yet."],
  locked_inspection: ["لا يمكن تعديل الفحص بعد إرساله.", "The inspection can't be changed after submission."],
  uploads_pending: ["انتظر حتى يكتمل رفع كل الملفات.", "Wait for all uploads to finish."],
  not_enough_evidence: ["أضف 4 صور على الأقل.", "Add at least 4 photos."],
  monthly_quota_reached: ["استخدمت كل فحوصاتك المجانية لهذا الشهر.", "You used all your free inspections for this month."],
  daily_capacity_reached: ["اكتملت سعة التحليل لليوم. أرسل الفحص غداً.", "Today's analysis capacity is full. Submit again tomorrow."],
  submissions_paused: ["استقبال الفحوصات متوقف مؤقتاً.", "New inspections are paused for now."],
  already_submitted: ["أُرسل هذا الفحص مسبقاً.", "This inspection was already submitted."],
  retry_limit: ["أُعيدت المحاولة مرتين. تواصل مع الدعم.", "Already retried twice. Please contact support."],
  too_many_drafts: ["لديك 10 مسودات. أكمل أو احذف واحدة أولاً.", "You have 10 drafts. Finish or delete one first."],
  analysis_running: ["يوجد تحليل قيد التشغيل. حاول بعد دقائق.", "An analysis is running. Try again in a few minutes."],
  invalid_code: ["الرمز غير صحيح.", "That code is not valid."],
  not_failed: ["لا يمكن إعادة المحاولة إلا لتحليل فاشل.", "Only a failed analysis can be retried."],
  not_completed: ["لا يمكن إعادة التحليل إلا لفحص مكتمل.", "Only completed inspections can be re-analysed."],
  job_running: ["يوجد تحليل في الانتظار أو قيد التشغيل لهذا الفحص.", "An analysis is already queued or running."],
  self: ["لا يمكنك تعديل حسابك من هنا.", "You cannot change your own account here."],
  already_enrolled: ["التحقق الثنائي مفعّل مسبقاً.", "Two-factor authentication is already set up."],
  mfa_not_started: ["ابدأ إعداد التحقق الثنائي أولاً.", "Start two-factor setup first."],
  admin_account: ["أزل صلاحية المدير قبل حذف هذا الحساب.", "Remove admin rights before deleting this account."],
  network: ["تعذر الاتصال. تحقق من الإنترنت.", "Network error. Check your connection."],
  internal: ["حدث خطأ من جهتنا وتم تسجيله.", "Something went wrong on our side. It has been logged."],
};

export function errorText(e: ApiError, locale: "ar" | "en"): string {
  const code = e.code === "locked" && e.message.includes("edited") ? "locked_inspection" : e.code;
  const m = MESSAGES[code];
  if (!m) return locale === "en" ? e.message : `${e.message}`;
  // Rejection reasons from the server are specific; show them alongside.
  if (code === "evidence_rejected") return `${m[locale === "ar" ? 0 : 1]} (${e.message})`;
  return m[locale === "ar" ? 0 : 1];
}
