/** Maps machine-readable error codes raised by the database to Arabic messages */
const MESSAGES: Record<string, string> = {
  INVALID_NAME: "يرجى كتابة الاسم بشكل صحيح (حرفان على الأقل).",
  INVALID_PHONE: "رقم الجوال غير صحيح. اكتبه بالأرقام فقط، مثل 05xxxxxxxx.",
  INVALID_EMAIL: "البريد الإلكتروني غير صحيح.",
  INVALID_CHILDREN: "عدد الأطفال غير مقبول.",
  INVALID_NOTES: "الملاحظات طويلة جداً.",
  INVALID_SUBJECT: "عنوان الرسالة طويل جداً.",
  INVALID_MESSAGE: "يرجى كتابة رسالة بين 5 و2000 حرف.",
  CONTACT_REQUIRED: "أضف رقم جوال أو بريداً إلكترونياً لنتمكن من الرد عليك.",
  SERVICE_UNAVAILABLE: "هذه الخدمة غير متاحة للحجز حالياً.",
  INVALID_DATE: "يرجى اختيار تاريخ صحيح.",
  INVALID_SLOT: "الوقت المختار غير صالح. اختر وقتاً من القائمة.",
  DATE_OUT_OF_RANGE: "هذا التاريخ خارج فترة الحجز المتاحة.",
  DAY_CLOSED: "الاستوديو مغلق في هذا اليوم.",
  OUTSIDE_HOURS: "الوقت المختار خارج ساعات العمل.",
  TOO_SOON: "هذا الموعد قريب جداً. اختر موعداً لاحقاً.",
  TOO_MANY_BOOKINGS: "لديك عدة حجوزات قادمة بهذا الرقم. تواصل معنا لإضافة حجز جديد.",
  SLOT_TAKEN: "عذراً، حُجز هذا الموعد للتو. اختر وقتاً آخر.",
  FULLY_BOOKED: "لا توجد مواعيد متاحة في هذا اليوم.",
  NOT_FOUND: "لم نعثر على الحجز.",
  CANNOT_CANCEL: "لا يمكن إلغاء هذا الحجز إلكترونياً الآن. تواصل معنا مباشرة.",
  NOT_ACTIVE: "لا يمكن تعديل حجز مكتمل أو ملغى.",
  INVALID_STATUS: "حالة غير صحيحة.",
  RATE_LIMITED: "أرسلت عدة رسائل خلال وقت قصير. حاول مرة أخرى بعد قليل.",
  FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء.",
  NOT_CONFIGURED: "لم يتم ربط قاعدة البيانات بعد. أكمل إعداد Supabase أولاً.",
};

export const GENERIC_ERROR = "حدث خطأ غير متوقع. حاول مرة أخرى.";

export function errorMessage(codeOrMessage: string | undefined | null): string {
  if (!codeOrMessage) return GENERIC_ERROR;
  const code = codeOrMessage.trim().split(/\s/)[0];
  return MESSAGES[code] ?? GENERIC_ERROR;
}

export function isKnownError(code: string): boolean {
  return code in MESSAGES;
}
