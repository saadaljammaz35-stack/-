import type { Namespace } from "../types";

/**
 * User-facing error text. Keys are the machine codes from docs/API.md (and a
 * few Postgres / Supabase Auth codes); `errorText()` in src/lib/errors.ts maps
 * any thrown error to one of these.
 */
export default {
  ar: {
    title: "حدث خطأ",
    unknown: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.",
    reference: "رقم المرجع للدعم: {id}",
    network_error: "تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
    // Edge Function errors (docs/API.md)
    invalid_json: "تعذّرت قراءة الطلب. أعد تحميل الصفحة وحاول مرة أخرى.",
    invalid_request: "بعض البيانات غير صحيحة. راجع الحقول وحاول مرة أخرى.",
    unauthorized: "انتهت جلستك. سجّل الدخول مرة أخرى.",
    forbidden: "لا تملك صلاحية تنفيذ هذا الإجراء في هذه العيادة.",
    insufficient_role: "هذا الإجراء متاح لمالك العيادة أو مديرها فقط.",
    not_found: "لم يُعثر على العنصر المطلوب. ربما حُذف.",
    method_not_allowed: "طريقة الطلب غير مدعومة.",
    payload_too_large: "البيانات المرسلة كبيرة جداً.",
    rate_limited: "طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.",
    rate_limited_retry: "طلبات كثيرة خلال وقت قصير. حاول مرة أخرى بعد {seconds} ثانية.",
    upstream_error:
      "تعذّر الوصول إلى خدمة خارجية (الذكاء الاصطناعي أو واتساب). حاول مرة أخرى بعد قليل.",
    not_configured: "هذه الخدمة غير مهيأة على الخادم بعد. تواصل مع الدعم.",
    rate_limit_unavailable: "الخدمة غير متاحة مؤقتاً. حاول مرة أخرى بعد قليل.",
    internal_error: "حدث خطأ في الخادم. حاول مرة أخرى، وإذا تكرر فأرسل رقم المرجع للدعم.",
    database_error: "تعذّر حفظ البيانات أو قراءتها. حاول مرة أخرى بعد قليل.",
    subscription_inactive: "اشتراك العيادة غير نشط. فعّل الاشتراك لاستخدام هذه الميزة.",
    ai_quota_exhausted: "استُنفدت ردود الذكاء الاصطناعي لهذا الشهر في باقتك الحالية.",
    phone_number_in_use: "رقم واتساب هذا مربوط بعيادة أخرى.",
    outside_service_window:
      "مرّت أكثر من 24 ساعة على آخر رسالة من المريض. لا يسمح واتساب إلا بإرسال قالب معتمد.",
    whatsapp_not_connected: "واتساب غير مربوط بهذه العيادة بعد.",
    customer_opted_out: "طلب هذا المريض إيقاف الرسائل، لذلك لا يمكن مراسلته.",
    not_confirmed: "أكّد الموعد وحدّد وقته أولاً قبل إبلاغ المريض.",
    no_channel: "سُجّل هذا الطلب يدوياً ولا توجد محادثة لإرسال التأكيد عبرها. اتصل بالمريض.",
    template_required:
      "مرّت أكثر من 24 ساعة على آخر رسالة من المريض، ولا يوجد قالب تأكيد مضبوط في إعدادات واتساب.",
    already_member: "هذا الشخص عضو في فريق العيادة بالفعل.",
    seat_limit: "وصلت إلى الحد الأقصى لأعضاء الفريق في باقتك الحالية.",
    // Database (RPC) errors
    slug_taken: "رابط العيادة هذا مستخدم. اختر رابطاً آخر.",
    org_limit: "وصلت إلى الحد الأقصى لعدد العيادات التي يمكنك إنشاؤها (3).",
    last_owner: "يجب أن يبقى للعيادة مالك واحد على الأقل.",
    assistant_not_tested: "جرّب المساعد بنجاح في صفحة التجربة قبل تفعيله للمرضى.",
    confirm_mismatch: "النص الذي كتبته لا يطابق رابط العيادة.",
    unique_violation: "هذا العنصر موجود بالفعل.",
    check_violation: "لا يمكن حفظ هذه القيمة. راجع البيانات وحاول مرة أخرى.",
    // Supabase Auth
    invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    email_not_confirmed: "لم يتم تأكيد بريدك الإلكتروني بعد.",
    user_already_exists: "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول أو استعد كلمة المرور.",
    weak_password: "كلمة المرور ضعيفة أو شائعة. اختر كلمة مرور أطول وأصعب تخميناً.",
    same_password: "كلمة المرور الجديدة يجب أن تختلف عن الحالية.",
    over_email_send_rate_limit:
      "أرسلنا رسائل كثيرة لهذا البريد مؤخراً. انتظر دقيقة ثم حاول مرة أخرى.",
    signup_disabled: "إنشاء الحسابات الجديدة متوقف مؤقتاً.",
    session_expired: "انتهت جلستك. سجّل الدخول مرة أخرى.",
    link_expired: "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطاً جديداً.",
    email_address_invalid: "هذا البريد الإلكتروني غير مقبول. استخدم بريداً آخر.",
  },
  en: {
    title: "Something went wrong",
    unknown: "Something unexpected went wrong. Please try again shortly.",
    reference: "Support reference: {id}",
    network_error: "We couldn't reach the server. Check your internet connection and try again.",
    // Edge Function errors (docs/API.md)
    invalid_json: "We couldn't read that request. Reload the page and try again.",
    invalid_request: "Some details aren't valid. Check the fields and try again.",
    unauthorized: "Your session has ended. Please sign in again.",
    forbidden: "You don't have permission to do this in this clinic.",
    insufficient_role: "Only the clinic's owner or an admin can do this.",
    not_found: "We couldn't find that. It may have been deleted.",
    method_not_allowed: "That request method isn't supported.",
    payload_too_large: "That's too much data to send at once.",
    rate_limited: "Too many requests in a short time. Wait a moment and try again.",
    rate_limited_retry: "Too many requests in a short time. Try again in {seconds} seconds.",
    upstream_error: "An outside service (AI or WhatsApp) didn't respond. Please try again shortly.",
    not_configured: "This service hasn't been set up on the server yet. Please contact support.",
    rate_limit_unavailable: "The service is temporarily unavailable. Please try again shortly.",
    internal_error:
      "A server error occurred. Try again, and if it keeps happening send the reference to support.",
    database_error: "We couldn't save or load the data. Please try again shortly.",
    subscription_inactive:
      "The clinic's subscription isn't active. Activate it to use this feature.",
    ai_quota_exhausted: "This month's AI replies for your plan have been used up.",
    phone_number_in_use: "This WhatsApp number is already connected to another clinic.",
    outside_service_window:
      "The patient's last message was more than 24 hours ago. WhatsApp only allows an approved template now.",
    whatsapp_not_connected: "WhatsApp isn't connected to this clinic yet.",
    customer_opted_out:
      "This patient asked to stop receiving messages, so they can't be contacted here.",
    not_confirmed: "Confirm the appointment and set its time before notifying the patient.",
    no_channel:
      "This request was added by hand, so there's no conversation to send the confirmation to. Call the patient.",
    template_required:
      "The patient's last message was more than 24 hours ago and no confirmation template is set in WhatsApp settings.",
    already_member: "This person is already on the clinic's team.",
    seat_limit: "You've reached the team member limit for your current plan.",
    // Database (RPC) errors
    slug_taken: "That clinic link is taken. Please choose another.",
    org_limit: "You've reached the maximum number of clinics you can create (3).",
    last_owner: "A clinic must keep at least one owner.",
    assistant_not_tested:
      "Run a successful test of the assistant before switching it on for patients.",
    confirm_mismatch: "What you typed doesn't match the clinic link.",
    unique_violation: "That already exists.",
    check_violation: "That value can't be saved. Check the details and try again.",
    // Supabase Auth
    invalid_credentials: "The email or password is incorrect.",
    email_not_confirmed: "Your email address isn't confirmed yet.",
    user_already_exists:
      "An account with this email already exists. Sign in or reset your password.",
    weak_password: "That password is too weak or too common. Choose a longer, harder-to-guess one.",
    same_password: "The new password must be different from your current one.",
    over_email_send_rate_limit:
      "We've sent several emails to this address recently. Wait a minute and try again.",
    signup_disabled: "New sign-ups are paused for now.",
    session_expired: "Your session has ended. Please sign in again.",
    link_expired: "The link has expired or was already used. Ask for a new one.",
    email_address_invalid: "This email address isn't accepted. Please use another.",
  },
} satisfies Namespace;
