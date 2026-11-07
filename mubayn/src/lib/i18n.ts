export type Locale = "ar" | "en";

/**
 * All user-facing strings. Arabic first. Keep sentences short and plain.
 */
const dict = {
  brand: { ar: "مُبيّن", en: "MUBAYN" },
  tagline: { ar: "اعرف وش حالة الجهاز المستعمل قبل لا تدفع", en: "Know a used device's condition before you pay" },

  // nav
  nav_how: { ar: "وشلون يشتغل", en: "How it works" },
  nav_faq: { ar: "أسئلة تتكرر", en: "FAQ" },
  nav_contact: { ar: "كلّمنا", en: "Contact" },
  nav_login: { ar: "دخول", en: "Sign in" },
  nav_register: { ar: "ابدأ فحصك المجاني", en: "Start a free inspection" },
  nav_dashboard: { ar: "فحوصاتي", en: "My inspections" },
  nav_account: { ar: "حسابي", en: "Account" },
  nav_admin: { ar: "الإدارة", en: "Admin" },
  nav_logout: { ar: "خروج", en: "Sign out" },
  switch_lang: { ar: "English", en: "العربية" },

  // footer
  footer_terms: { ar: "الشروط والأحكام", en: "Terms of service" },
  footer_privacy: { ar: "سياسة الخصوصية", en: "Privacy policy" },
  footer_ai: { ar: "وش يقدر يشوف الذكاء الاصطناعي ووش ما يقدر", en: "What AI inspection can and cannot do" },
  footer_rights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved" },

  // auth
  email: { ar: "الإيميل", en: "E-mail" },
  password: { ar: "كلمة السر", en: "Password" },
  password_hint: { ar: "10 حروف وأكثر", en: "At least 10 characters" },
  full_name: { ar: "اسمك", en: "Name" },
  register_title: { ar: "سوّ حسابك", en: "Create your account" },
  register_sub: { ar: "الفحص مجاني، والحساب عشان نحفظ تقاريرك لك بأمان.", en: "Inspections are free. An account keeps your reports private and safe." },
  register_btn: { ar: "سوّ الحساب", en: "Create account" },
  register_done: { ar: "أرسلنا لك رابط تأكيد على إيميلك. افتحه عشان يتفعّل حسابك، وبعدين ادخل.", en: "We sent a confirmation link to your e-mail. Open it to activate your account, then sign in." },
  agree_terms: { ar: "موافق على الشروط والأحكام وسياسة الخصوصية", en: "I agree to the Terms of service and Privacy policy" },
  have_account: { ar: "عندك حساب؟", en: "Already have an account?" },
  no_account: { ar: "ما عندك حساب؟", en: "No account yet?" },
  login_title: { ar: "ادخل حسابك", en: "Sign in" },
  login_btn: { ar: "دخول", en: "Sign in" },
  forgot: { ar: "نسيت كلمة السر؟", en: "Forgot your password?" },
  forgot_title: { ar: "نسيت كلمة السر", en: "Reset your password" },
  forgot_btn: { ar: "أرسل رابط الاسترجاع", en: "Send reset link" },
  forgot_done: { ar: "إذا الإيميل مسجّل عندنا بتوصلك رسالة خلال دقايق. الرابط يشتغل ساعة وحدة بس.", en: "If that e-mail has an account, a message is on its way. The link works for one hour." },
  reset_title: { ar: "كلمة سر جديدة", en: "Choose a new password" },
  reset_btn: { ar: "احفظ كلمة السر", en: "Save password" },
  reset_done: { ar: "تغيّرت كلمة السر وطلّعناك من كل الأجهزة. ادخل من جديد.", en: "Password changed and every device signed out. Sign in again." },
  verify_ok: { ar: "تأكّد إيميلك.", en: "Your e-mail is confirmed." },
  verify_bad: { ar: "الرابط ما يشتغل أو خلص وقته.", en: "This link is invalid or has expired." },
  verify_banner: { ar: "أكّد إيميلك عشان تقدر ترسل الفحص.", en: "Confirm your e-mail before you can submit an inspection." },
  verify_resend: { ar: "أرسل رابط التأكيد مرة ثانية", en: "Resend confirmation link" },
  verify_sent: { ar: "أرسلناه.", en: "Link sent." },

  // dashboard
  dash_title: { ar: "فحوصاتي", en: "My inspections" },
  dash_new: { ar: "فحص جديد", en: "New inspection" },
  dash_empty: { ar: "ما عندك فحوصات للحين. ابدأ بأول جهاز.", en: "No inspections yet. Start with your first device." },
  quota_left: { ar: "باقي لك هالشهر", en: "Left this month" },
  view_report: { ar: "شوف التقرير", en: "View report" },
  continue_draft: { ar: "كمّل الفحص", en: "Continue" },

  // statuses
  st_draft: { ar: "مسودة", en: "Draft" },
  st_queued: { ar: "ينتظر دوره", en: "Queued" },
  st_analyzing: { ar: "قاعد يتحلل", en: "Analysing" },
  st_completed: { ar: "جاهز", en: "Completed" },
  st_failed: { ar: "ما اكتمل التحليل", en: "Analysis failed" },
  st_canceled: { ar: "ملغي", en: "Canceled" },

  // inspection form
  insp_new_title: { ar: "معلومات الجهاز", en: "Device details" },
  insp_new_sub: { ar: "اكتب كلام البائع مثل ما هو، وحنا نقارنه باللي يبان في الصور.", en: "Write what the seller says. We compare it with what the photos show." },
  f_category: { ar: "وش نوع الجهاز", en: "Device type" },
  f_brand: { ar: "الشركة", en: "Brand" },
  f_model: { ar: "الموديل", en: "Model" },
  f_storage: { ar: "المساحة (إذا تبي)", en: "Storage (optional)" },
  f_color: { ar: "اللون (إذا تبي)", en: "Colour (optional)" },
  f_context: { ar: "أنت", en: "You are" },
  f_claims: { ar: "كلام البائع أو نص الإعلان (إذا تبي)", en: "Seller's claims or listing text (optional)" },
  f_claims_ph: { ar: "مثلاً: نظيف مرة، ما فيه ولا خدش، البطارية 92٪، ما قد انفتح", en: "e.g. Like new, no scratches, battery 92%, never opened" },
  f_price: { ar: "السعر المطلوب (إذا تبي)", en: "Asking price (optional)" },
  f_lang: { ar: "لغة التقرير", en: "Report language" },
  ctx_buying: { ar: "ناوي أشتريه", en: "Thinking of buying" },
  ctx_selling: { ar: "أبي أبيعه", en: "Selling it" },
  ctx_owner: { ar: "حقي وأبي أعرف وش حالته", en: "The owner checking its condition" },
  cat_phone: { ar: "جوال", en: "Phone" },
  cat_tablet: { ar: "تابلت", en: "Tablet" },
  cat_laptop: { ar: "لابتوب", en: "Laptop" },
  cat_smartwatch: { ar: "ساعة ذكية", en: "Smartwatch" },
  cat_console: { ar: "جهاز ألعاب", en: "Game console" },
  cat_camera: { ar: "كاميرا", en: "Camera" },
  cat_headphones: { ar: "سماعات", en: "Headphones" },
  cat_other: { ar: "غيره", en: "Other" },
  save_continue: { ar: "احفظ وكمّل للصور", en: "Save and add photos" },
  save: { ar: "احفظ", en: "Save" },

  // evidence
  ev_title: { ar: "الأدلة: صور وفيديو", en: "Evidence: photos and video" },
  ev_guide: {
    ar: "صوّر في مكان نوره زين وبدون فلاش مباشر. نحتاج 4 صور على الأقل: الشاشة من قدّام وهي شغّالة، الظهر، الأطراف والمنافذ، والكاميرات. وإذا تعرف فيه عيب صوّره من قريب.",
    en: "Shoot in good light without direct flash. We need at least 4 photos: front with the screen on, back, edges and ports, and cameras. Add a close-up of any defect you know about.",
  },
  ev_pick: { ar: "اختر صور أو فيديو", en: "Choose photos or a video" },
  ev_types: { ar: "JPEG أو PNG أو WebP إلين 15 ميجا. فيديو MP4 أو MOV إلين 100 ميجا.", en: "JPEG, PNG or WebP up to 15 MB. MP4 or MOV video up to 100 MB." },
  ev_uploading: { ar: "قاعد يرفع", en: "Uploading" },
  ev_checking: { ar: "نتأكد من الملف", en: "Checking file" },
  ev_ready: { ar: "جاهز", en: "Ready" },
  ev_rejected: { ar: "مرفوض", en: "Rejected" },
  ev_remove: { ar: "احذف", en: "Remove" },
  ev_count: { ar: "صور جاهزة", en: "photos ready" },
  ev_min: { ar: "حط 4 صور على الأقل", en: "Add at least 4 photos" },
  ev_label_ph: { ar: "وصف إذا تبي، مثل: الظهر", en: "Optional caption, e.g. back" },

  submit_title: { ar: "أرسله للتحليل", en: "Send for analysis" },
  submit_note: {
    ar: "بعد ما ترسل ما تقدر تعدّل الأدلة. الذكاء الاصطناعي يحلل اللي يبان في الصور بس، والتقرير يجهز عادةً خلال دقايق.",
    en: "After you submit, the evidence is locked. The AI analyses only what the photos show. The report usually arrives within minutes.",
  },
  submit_btn: { ar: "أرسل الفحص", en: "Submit inspection" },
  delete_draft: { ar: "احذف المسودة", en: "Delete draft" },

  progress_title: { ar: "قاعدين نحلل الأدلة", en: "Analysing your evidence" },
  progress_sub: { ar: "الصفحة تتحدث لحالها وتفتح التقرير أول ما يجهز. تقدر تسكّرها وترجع بعدين، وبتلقى التقرير في «فحوصاتي».", en: "This page updates by itself and opens the report as soon as it is ready. You can close it and come back later: the report will be in your dashboard." },
  failed_title: { ar: "ما اكتمل التحليل", en: "The analysis did not finish" },
  failed_sub: { ar: "ما طلّعنا أي تقرير، لأننا ما نطلّع تقرير إلا من تحليل مكتمل فعلاً. تقدر تعيد المحاولة.", en: "No report was produced. We never issue a report without a completed analysis. You can try again." },
  retry_btn: { ar: "عِد المحاولة", en: "Try again" },

  // report
  rp_title: { ar: "تقرير الفحص البصري", en: "Visual inspection report" },
  rp_version: { ar: "الإصدار", en: "Version" },
  rp_generated: { ar: "تاريخ التحليل", en: "Analysed" },
  rp_download: { ar: "نزّل PDF", en: "Download PDF" },
  rp_overall: { ar: "الحالة العامة", en: "Overall condition" },
  rp_score: { ar: "درجة الحالة", en: "Condition score" },
  rp_confidence: { ar: "درجة الثقة", en: "Confidence" },
  rp_summary: { ar: "الخلاصة", en: "Summary" },
  rp_findings: { ar: "الملاحظات", en: "Findings" },
  rp_evidence: { ar: "الدليل", en: "Evidence" },
  rp_claims: { ar: "مقارنة ادعاءات البائع", en: "Seller claims check" },
  rp_not_covered: { ar: "أجزاء لم تظهر في الأدلة", en: "Not shown in the evidence" },
  rp_limitations: { ar: "حدود هذا التقرير", en: "Limitations" },
  rp_checks: { ar: "افحصه بنفسك قبل لا تدفع", en: "Check in person before paying" },
  rp_device_match: { ar: "هل الأدلة للجهاز المذكور؟", en: "Does the evidence show the declared device?" },
  rp_quality: { ar: "جودة الأدلة", en: "Evidence quality" },
  rp_index: { ar: "فهرس الأدلة", en: "Evidence index" },
  rp_trace: { ar: "إمكانية التتبع", en: "Traceability" },
  rp_disclaimer: {
    ar: "هذا التقرير تحليل آلي بالذكاء الاصطناعي للصور ومقاطع الفيديو التي رفعها العميل فقط. ليس فحصاً فنياً مباشراً ولا شهادة ولا ضماناً لحالة الجهاز أو أصالته أو سلامته الداخلية. قد يخطئ التحليل، فتحقق بنفسك من الجهاز قبل الشراء.",
    en: "This report is an automated AI analysis of the photos and videos the customer uploaded, and nothing else. It is not a hands-on technical inspection, a certification, or a guarantee of the device's condition, authenticity or internal health. The analysis can be wrong. Check the device yourself before buying.",
  },
  sev_info: { ar: "ملاحظة", en: "Note" },
  sev_minor: { ar: "بسيط", en: "Minor" },
  sev_moderate: { ar: "متوسط", en: "Moderate" },
  sev_major: { ar: "كبير", en: "Major" },
  sev_critical: { ar: "حرج", en: "Critical" },
  cond_excellent: { ar: "ممتازة", en: "Excellent" },
  cond_good: { ar: "جيدة", en: "Good" },
  cond_fair: { ar: "مقبولة", en: "Fair" },
  cond_poor: { ar: "ضعيفة", en: "Poor" },
  cond_insufficient_evidence: { ar: "الأدلة غير كافية", en: "Not enough evidence" },
  conf_low: { ar: "منخفضة", en: "Low" },
  conf_medium: { ar: "متوسطة", en: "Medium" },
  conf_high: { ar: "عالية", en: "High" },
  match_yes: { ar: "نعم", en: "Yes" },
  match_no: { ar: "لا", en: "No" },
  match_uncertain: { ar: "غير مؤكد", en: "Uncertain" },
  q_good: { ar: "جيدة", en: "Good" },
  q_fair: { ar: "مقبولة", en: "Fair" },
  q_poor: { ar: "ضعيفة", en: "Poor" },
  v_consistent: { ar: "متوافق", en: "Consistent" },
  v_contradicted: { ar: "متعارض", en: "Contradicted" },
  v_not_verifiable: { ar: "لا يمكن التحقق", en: "Not verifiable" },
  photo: { ar: "صورة", en: "Photo" },
  frame_at: { ar: "لقطة من الفيديو عند", en: "Video frame at" },

  // account
  acc_title: { ar: "حسابي", en: "My account" },
  acc_change_pw: { ar: "غيّر كلمة السر", en: "Change password" },
  acc_current_pw: { ar: "كلمة السر الحالية", en: "Current password" },
  acc_new_pw: { ar: "كلمة السر الجديدة", en: "New password" },
  acc_export: { ar: "نزّل نسخة من بياناتي", en: "Download a copy of my data" },
  acc_delete: { ar: "احذف الحساب نهائياً", en: "Delete account permanently" },
  acc_delete_warn: {
    ar: "بينحذف حسابك وكل الصور والفيديوهات والتقارير نهائياً وما تقدر ترجّعها. اكتب كلمة السر عشان تأكّد.",
    en: "Your account and every photo, video and report will be deleted permanently and cannot be recovered. Enter your password to confirm.",
  },
  acc_delete_btn: { ar: "احذف حسابي", en: "Delete my account" },
  acc_saved: { ar: "انحفظ.", en: "Saved." },

  // no-email deployments: recovery codes
  email_login_hint: { ar: "نستخدمه بس عشان تدخل فيه، وما نرسل له ولا رسالة.", en: "Used only as your sign-in name. We never send e-mail to it." },
  rc_title: { ar: "احفظ رمز الاسترجاع", en: "Save your recovery code" },
  rc_body: {
    ar: "هذا الرمز هو الطريقة الوحيدة ترجع فيها لحسابك لو نسيت كلمة السر، لأننا ما نرسل إيميلات. انسخه أو نزّله واحفظه في مكان آمن، تراه ما بيطلع لك مرة ثانية.",
    en: "This code is the only way back into your account if you forget your password, because we do not send e-mail. Copy or download it and keep it somewhere safe. It will not be shown again.",
  },
  rc_copy: { ar: "انسخ", en: "Copy" },
  rc_copied: { ar: "تم النسخ", en: "Copied" },
  rc_download: { ar: "نزّله ملف", en: "Download as a file" },
  rc_saved: { ar: "حفظت الرمز في مكان آمن", en: "I have saved this code somewhere safe" },
  rc_continue: { ar: "كمّل", en: "Continue" },
  rc_file_note: { ar: "رمز استرجاع حساب مُبيّن. لا تعطيه أحد.", en: "MUBAYN account recovery code. Keep it private." },
  recovery_code: { ar: "رمز الاسترجاع", en: "Recovery code" },
  recover_intro: {
    ar: "اكتب إيميلك ورمز الاسترجاع اللي حفظته يوم سجّلت، وبعدين اختر كلمة سر جديدة. بيطلع لك رمز جديد بدل القديم.",
    en: "Enter your e-mail and the recovery code you saved when you signed up, then choose a new password. You will get a new recovery code in place of the old one.",
  },
  recover_lost: {
    ar: "ضيّعت الرمز؟ راسلنا من صفحة «كلّمنا» بنفس الإيميل اللي سجّلت فيه، ونرد عليك على نفس الإيميل برمز جديد بعد ما نتأكد.",
    en: "Lost the code? Write to us from the contact page using the same e-mail you signed up with; we will reply to that address with a new code after checking.",
  },
  recover_btn: { ar: "غيّر كلمة السر", en: "Change password" },
  recover_done: { ar: "تغيّرت كلمة السر وطلّعناك من كل الأجهزة. احفظ رمز الاسترجاع الجديد وبعدين ادخل.", en: "Your password was changed and every device was signed out. Save your new recovery code, then sign in." },
  acc_rc_title: { ar: "رمز الاسترجاع", en: "Recovery code" },
  acc_rc_sub: {
    ar: "إذا ضيّعت رمز الاسترجاع أو تحس أن أحد شافه، طلّع رمز جديد، والقديم يوقف على طول.",
    en: "If you lost your recovery code or think someone saw it, issue a new one. The old code stops working at once.",
  },
  acc_rc_none: { ar: "حسابك ما له رمز استرجاع للحين. طلّع واحد الحين.", en: "Your account has no recovery code yet. Issue one now." },
  acc_rc_since: { ar: "الرمز الحالي طالع بتاريخ", en: "Current code issued on" },
  acc_rc_btn: { ar: "طلّع رمز جديد", en: "Issue a new code" },
  dash_no_rc: { ar: "حسابك ما له رمز استرجاع، وبدونه ما تقدر ترجع لحسابك لو نسيت كلمة السر.", en: "Your account has no recovery code. Without one you cannot get back in if you forget your password." },
  dash_no_rc_link: { ar: "طلّعه من صفحة حسابي", en: "Issue one on the account page" },

  // generic
  error_generic: { ar: "صار خطأ. جرّب مرة ثانية.", en: "Something went wrong. Please try again." },
  loading: { ar: "لحظة…", en: "Loading…" },
  back: { ar: "رجوع", en: "Back" },
  not_found: { ar: "الصفحة مهيب موجودة", en: "Page not found" },
} as const;

export type Key = keyof typeof dict;

export function t(locale: Locale, key: Key): string {
  return dict[key][locale];
}

export function translator(locale: Locale) {
  return (key: Key) => dict[key][locale];
}

export function isKey(k: string): k is Key {
  return k in dict;
}
