import type { Namespace } from "../types";

export default {
  ar: {
    title: "معلومات العيادة",
    description:
      "الخدمات والأسعار والأسئلة الشائعة التي يعتمد عليها المساعد في إجاباته. لا يذكر المساعد سعراً أو معلومة غير مسجّلة هنا.",
    readOnlyTitle: "للاطلاع فقط",
    readOnlyText:
      "يمكنك مراجعة الخدمات والأسئلة الشائعة، أما الإضافة والتعديل والحذف فمتاحة لمالك العيادة أو مديرها فقط.",
    tabsLabel: "أقسام معلومات العيادة",
    tabServices: "الخدمات والأسعار",
    tabFaqs: "الأسئلة الشائعة",

    // Services
    servicesTitle: "الخدمات",
    servicesDescription:
      "يذكر المساعد الخدمات المفعّلة وأسعارها فقط. إن سأل المريض عن سعر غير مسجّل، يقول إنه لا يملك المعلومة ويعطي رقم الاستقبال إن كان مسجلاً، أو يحوّل السؤال إلى فريق الاستقبال.",
    addService: "إضافة خدمة",
    servicesEmptyTitle: "لا توجد خدمات بعد",
    servicesEmptyText:
      "أضف خدمات العيادة وأسعارها ليتمكّن المساعد من الإجابة عن أسئلة الأسعار. ما لم تُضف خدمات، يخبر المساعد المريض أنه لا يملك المعلومة ويعطي رقم الاستقبال أو يحوّل السؤال إلى الاستقبال.",
    servicesEmptyReadOnly: "لم تُضَف أي خدمة بعد. يضيفها مالك العيادة أو مديرها.",
    servicesListLabel: "قائمة الخدمات",
    serviceInactive: "مخفية عن المساعد",
    activeShort: "مفعّل",
    moveUp: "نقل «{name}» إلى الأعلى",
    moveDown: "نقل «{name}» إلى الأسفل",
    movedUp: "نُقل «{name}» إلى الأعلى",
    movedDown: "نُقل «{name}» إلى الأسفل",
    editItem: "تعديل «{name}»",
    deleteItem: "حذف «{name}»",
    durationMinutes: "{minutes} دقيقة",
    priceOnConsultation: "يحدد بعد الاستشارة",
    priceStartingFrom: "يبدأ من {price}",
    serviceCreated: "أُضيفت الخدمة.",
    serviceSaved: "حُفظت التغييرات على الخدمة.",
    serviceDeleted: "حُذفت الخدمة.",
    deleteServiceTitle: "حذف هذه الخدمة؟",
    deleteServiceText:
      "سيتوقف المساعد عن ذكر «{name}». تبقى طلبات المواعيد السابقة ببياناتها كاملة، لكنها لن تبقى مرتبطة بهذه الخدمة.",
    deleteServiceTip:
      "إن أردت إخفاء الخدمة مؤقتاً، فأوقف تفعيلها بدلاً من حذفها، وتستطيع إعادتها متى شئت.",

    // Service dialog
    serviceNewTitle: "إضافة خدمة",
    serviceEditTitle: "تعديل الخدمة",
    serviceDialogDescription:
      "اكتب الاسم بالعربية أو بالإنجليزية أو بكلتيهما، ويستخدم المساعد الاسم المناسب للغة المريض.",
    fieldNameAr: "اسم الخدمة بالعربية",
    fieldNameEn: "اسم الخدمة بالإنجليزية",
    nameHint: "يكفي اسم بلغة واحدة.",
    fieldPriceType: "طريقة التسعير",
    priceTypeFixed: "سعر ثابت",
    priceTypeStartingFrom: "يبدأ من سعر معيّن",
    priceTypeOnConsultation: "يحدد بعد الاستشارة",
    fieldPrice: "السعر بالريال",
    priceHint: "أرقام فقط، مثل 250 أو 199.50",
    currencyShort: "ر.س",
    priceConsultationHint:
      "لن يذكر المساعد أي رقم لهذه الخدمة، وسيوضّح للمريض أن السعر يحدد بعد الاستشارة.",
    fieldDuration: "المدة بالدقائق",
    durationHint: "من {min} إلى {max} دقيقة. اتركها فارغة إن كانت المدة تختلف من حالة لأخرى.",
    fieldDescriptionAr: "الوصف بالعربية",
    fieldDescriptionEn: "الوصف بالإنجليزية",
    descriptionHint: "معلومات مختصرة يستطيع المساعد ذكرها للمريض، حتى {max} حرف.",
    serviceActiveLabel: "الخدمة مفعّلة",
    serviceActiveHint: "يعرف المساعد الخدمة المفعّلة ويذكرها للمرضى، ويمكن ربط طلبات المواعيد بها.",

    // Validation
    errNameRequired: "اكتب اسم الخدمة بالعربية أو بالإنجليزية.",
    errTooLong: "النص أطول من الحد المسموح ({max} حرف).",
    errPriceType: "اختر طريقة التسعير.",
    errPriceRequired: "اكتب السعر، أو اختر «يحدد بعد الاستشارة».",
    errPriceInvalid: "اكتب السعر أرقاماً فقط، بمنزلتين عشريتين على الأكثر.",
    errPriceTooHigh: "السعر أعلى من الحد المسموح ({max} ر.س).",
    errDuration: "المدة عدد صحيح من {min} إلى {max} دقيقة.",
    errQuestionMissing: "اكتب السؤال الذي تجيب عنه هذه الإجابة.",
    errQuestionLength: "يجب أن يكون السؤال بين {min} و{max} حرفاً.",
    errAnswerMissing: "اكتب إجابة هذا السؤال.",
    errFaqPairRequired: "أدخل سؤالاً وإجابته بلغة واحدة على الأقل.",

    // FAQs
    faqsTitle: "الأسئلة الشائعة المعتمدة",
    faqsDescription:
      "إجابات راجعتها العيادة ووافقت عليها. يستخدمها المساعد عند سؤال مشابه، ولا يضيف إليها معلومات من عنده.",
    addFaq: "إضافة سؤال",
    faqsEmptyTitle: "لا توجد أسئلة شائعة بعد",
    faqsEmptyText:
      "أضف الأسئلة التي يكررها المرضى، مثل مواقف السيارات والتأمين وطرق الدفع، مع الإجابة المعتمدة لكل منها.",
    faqsEmptyReadOnly: "لم تُضَف أي أسئلة بعد. يضيفها مالك العيادة أو مديرها.",
    faqsListLabel: "قائمة الأسئلة الشائعة",
    faqInactive: "مخفي عن المساعد",
    langArabic: "العربية",
    langEnglish: "الإنجليزية",
    faqCreated: "أُضيف السؤال.",
    faqSaved: "حُفظت التغييرات على السؤال.",
    faqDeleted: "حُذف السؤال.",
    deleteFaqTitle: "حذف هذا السؤال؟",
    deleteFaqText:
      "لن يستخدم المساعد إجابة «{name}» بعد الآن، ولا يمكن التراجع عن الحذف. لإخفائه مؤقتاً أوقف تفعيله بدلاً من حذفه.",

    // FAQ dialog
    faqNewTitle: "إضافة سؤال شائع",
    faqEditTitle: "تعديل السؤال",
    faqDialogDescription:
      "أدخل السؤال وإجابته بالعربية أو بالإنجليزية أو بكلتيهما. كل لغة تحتاج سؤالاً وإجابة معاً، ويمكن ترك لغة فارغة بالكامل.",
    faqArabic: "بالعربية",
    faqEnglish: "بالإنجليزية",
    fieldQuestionAr: "السؤال بالعربية",
    fieldAnswerAr: "الإجابة بالعربية",
    fieldQuestionEn: "السؤال بالإنجليزية",
    fieldAnswerEn: "الإجابة بالإنجليزية",
    questionHint: "من {min} إلى {max} حرف.",
    answerHint: "حتى {max} حرف.",
    faqActiveLabel: "السؤال مفعّل",
    faqActiveHint: "يستخدم المساعد الأسئلة المفعّلة فقط في إجاباته.",

    // Preview
    previewTitle: "معاينة: ما سيعرفه المساعد",
    previewBadge: "معاينة",
    previewDescription:
      "عرض مبني على البيانات المحمّلة في هذه الصفحة: الخدمات والأسئلة المفعّلة وساعات العمل. هذا ليس رداً من المساعد.",
    previewShow: "عرض المعاينة",
    previewHide: "إخفاء المعاينة",
    previewServices: "الخدمات المفعّلة ({count})",
    previewNoServices: "لا توجد خدمات مفعّلة، لذلك لن يذكر المساعد أي خدمة أو سعر.",
    previewHours: "ساعات العمل",
    previewNoSettings: "تعذّر العثور على إعدادات العيادة.",
    daySat: "السبت",
    daySun: "الأحد",
    dayMon: "الاثنين",
    dayTue: "الثلاثاء",
    dayWed: "الأربعاء",
    dayThu: "الخميس",
    dayFri: "الجمعة",
    previewClosed: "مغلق",
    previewHoursNote: "ملاحظة: {note}",
    previewReception: "هاتف الاستقبال: {phone}",
    previewNoReception: "هاتف الاستقبال: غير مسجّل",
    previewEmergency: "رقم الطوارئ الذي يُوجَّه إليه المريض: {number}",
    previewSettingsLink: "تُعدَّل ساعات العمل وأرقام التواصل من {link}.",
    previewSettingsLinkText: "صفحة الإعدادات",
    previewFaqs: "الأسئلة المفعّلة ({count})",
    previewNoFaqs: "لا توجد أسئلة مفعّلة.",
    previewFootnote:
      "يقرأ المساعد النسخة المحفوظة من هذه البيانات عند كل رد، باللغتين. لتجربة ردوده فعلياً استخدم صفحة المساعد الذكي.",
  },
  en: {
    title: "Clinic knowledge",
    description:
      "The services, prices and FAQs the assistant answers from. It never quotes a price or fact that isn't listed here.",
    readOnlyTitle: "View only",
    readOnlyText:
      "You can review services and FAQs. Only the clinic's owner or an admin can add, edit or delete them.",
    tabsLabel: "Clinic knowledge sections",
    tabServices: "Services & prices",
    tabFaqs: "FAQs",

    // Services
    servicesTitle: "Services",
    servicesDescription:
      "The assistant mentions only active services and their prices. If a patient asks about a price that isn't listed, it says it doesn't have it and shares the reception phone if you've added one, or hands the question to reception.",
    addService: "Add service",
    servicesEmptyTitle: "No services yet",
    servicesEmptyText:
      "Add your services and prices so the assistant can answer price questions. Until you do, it tells patients it doesn't have that information and shares the reception phone or hands the question to reception.",
    servicesEmptyReadOnly: "No services have been added yet. The owner or an admin can add them.",
    servicesListLabel: "Services",
    serviceInactive: "Hidden from assistant",
    activeShort: "Active",
    moveUp: "Move “{name}” up",
    moveDown: "Move “{name}” down",
    movedUp: "Moved “{name}” up",
    movedDown: "Moved “{name}” down",
    editItem: "Edit “{name}”",
    deleteItem: "Delete “{name}”",
    durationMinutes: "{minutes} min",
    priceOnConsultation: "Set after consultation",
    priceStartingFrom: "From {price}",
    serviceCreated: "Service added.",
    serviceSaved: "Service changes saved.",
    serviceDeleted: "Service deleted.",
    deleteServiceTitle: "Delete this service?",
    deleteServiceText:
      "The assistant will stop mentioning “{name}”. Past appointment requests keep all their details but will no longer be linked to this service.",
    deleteServiceTip:
      "To hide a service for a while, switch it off instead of deleting it. You can switch it back on any time.",

    // Service dialog
    serviceNewTitle: "Add a service",
    serviceEditTitle: "Edit service",
    serviceDialogDescription:
      "Write the name in Arabic, English or both. The assistant uses the one that matches the patient's language.",
    fieldNameAr: "Service name in Arabic",
    fieldNameEn: "Service name in English",
    nameHint: "One language is enough.",
    fieldPriceType: "Pricing",
    priceTypeFixed: "Fixed price",
    priceTypeStartingFrom: "Starting from",
    priceTypeOnConsultation: "Set after consultation",
    fieldPrice: "Price in SAR",
    priceHint: "Numbers only, e.g. 250 or 199.50",
    currencyShort: "SAR",
    priceConsultationHint:
      "The assistant won't quote any number for this service and will explain that the price is set after a consultation.",
    fieldDuration: "Duration in minutes",
    durationHint: "{min} to {max} minutes. Leave empty if it varies.",
    fieldDescriptionAr: "Description in Arabic",
    fieldDescriptionEn: "Description in English",
    descriptionHint: "Short details the assistant may share, up to {max} characters.",
    serviceActiveLabel: "Service is active",
    serviceActiveHint:
      "The assistant knows about active services, mentions them to patients and can link appointment requests to them.",

    // Validation
    errNameRequired: "Enter the service name in Arabic or English.",
    errTooLong: "This is longer than allowed ({max} characters).",
    errPriceType: "Choose how this service is priced.",
    errPriceRequired: "Enter the price, or choose “Set after consultation”.",
    errPriceInvalid: "Enter the price as a number with at most two decimals.",
    errPriceTooHigh: "The price is higher than allowed (SAR {max}).",
    errDuration: "Duration must be a whole number from {min} to {max} minutes.",
    errQuestionMissing: "Enter the question this answer belongs to.",
    errQuestionLength: "The question must be {min} to {max} characters.",
    errAnswerMissing: "Enter the answer to this question.",
    errFaqPairRequired: "Enter a question and its answer in at least one language.",

    // FAQs
    faqsTitle: "Approved FAQs",
    faqsDescription:
      "Answers your clinic has reviewed and approved. The assistant uses them for similar questions and doesn't add details of its own.",
    addFaq: "Add question",
    faqsEmptyTitle: "No FAQs yet",
    faqsEmptyText:
      "Add the questions patients ask most — parking, insurance, payment methods — each with its approved answer.",
    faqsEmptyReadOnly: "No questions have been added yet. The owner or an admin can add them.",
    faqsListLabel: "FAQs",
    faqInactive: "Hidden from assistant",
    langArabic: "Arabic",
    langEnglish: "English",
    faqCreated: "Question added.",
    faqSaved: "Question changes saved.",
    faqDeleted: "Question deleted.",
    deleteFaqTitle: "Delete this question?",
    deleteFaqText:
      "The assistant will no longer use the answer to “{name}”. This can't be undone. To hide it for a while, switch it off instead.",

    // FAQ dialog
    faqNewTitle: "Add an FAQ",
    faqEditTitle: "Edit question",
    faqDialogDescription:
      "Enter the question and answer in Arabic, English or both. Each language needs both a question and an answer; you can leave a language completely empty.",
    faqArabic: "Arabic",
    faqEnglish: "English",
    fieldQuestionAr: "Question in Arabic",
    fieldAnswerAr: "Answer in Arabic",
    fieldQuestionEn: "Question in English",
    fieldAnswerEn: "Answer in English",
    questionHint: "{min} to {max} characters.",
    answerHint: "Up to {max} characters.",
    faqActiveLabel: "Question is active",
    faqActiveHint: "The assistant only uses active questions in its replies.",

    // Preview
    previewTitle: "Preview: what the assistant will know",
    previewBadge: "Preview",
    previewDescription:
      "Built from the data loaded on this page: active services, active FAQs and opening hours. This is not a reply from the assistant.",
    previewShow: "Show preview",
    previewHide: "Hide preview",
    previewServices: "Active services ({count})",
    previewNoServices: "No active services, so the assistant won't mention any service or price.",
    previewHours: "Opening hours",
    previewNoSettings: "The clinic's settings couldn't be found.",
    daySat: "Saturday",
    daySun: "Sunday",
    dayMon: "Monday",
    dayTue: "Tuesday",
    dayWed: "Wednesday",
    dayThu: "Thursday",
    dayFri: "Friday",
    previewClosed: "Closed",
    previewHoursNote: "Note: {note}",
    previewReception: "Reception phone: {phone}",
    previewNoReception: "Reception phone: not set",
    previewEmergency: "Emergency number patients are directed to: {number}",
    previewSettingsLink: "Opening hours and contact numbers are edited on the {link}.",
    previewSettingsLinkText: "Settings page",
    previewFaqs: "Active FAQs ({count})",
    previewNoFaqs: "No active FAQs.",
    previewFootnote:
      "The assistant reads the saved version of this data, in both languages, for every reply. To see how it actually answers, use the AI assistant page.",
  },
} satisfies Namespace;
