import type { Namespace } from "../types";

// Copy rules (enforced by src/components/marketing/copyGate.test.ts): no em
// dashes, no hype words, no invented numbers, customers, logos or claims.

export default {
  ar: {
    metaTitle: "موظف استقبال ذكي لعيادتك",

    // Header and navigation
    navLabel: "أقسام الصفحة",
    navHome: "الرئيسية",
    navFeatures: "المميزات",
    navHowItWorks: "كيف يعمل",
    navPricing: "الأسعار",
    navFaq: "الأسئلة الشائعة",
    navContact: "تواصل معنا",
    ctaStart: "ابدأ الآن",
    ctaSignIn: "تسجيل الدخول",
    ctaDashboard: "لوحة التحكم",

    // Hero
    heroBadge: "حل ذكي لعيادات المستقبل",
    heroTitle: "موظف استقبال ذكي {clinic}",
    heroTitleEmphasis: "لعيادتك",
    heroSubtitle:
      "يرد على استفسارات العملاء، يشرح خدماتك، يساعد في طلب المواعيد، ويحوّل الحالات للموظف عند الحاجة، على مدار الساعة.",
    heroCtaDemo: "اطلب عرضاً توضيحياً",
    heroPointsLabel: "ما يقدمه لعيادتك",
    heroPoint1: "مصمم لحماية بيانات المرضى",
    heroPoint2: "يوفر وقت فريق الاستقبال",
    heroPoint3: "طلبات مواعيد منظمة",

    // Example conversation in the phone mock
    mockLabel: "مثال توضيحي",
    mockCaption: "مثال توضيحي لمحادثة بين مريض ومساعد العيادة",
    mockClinic: "عيادتك",
    mockStatus: "مساعد آلي",
    mockPatient: "المريض:",
    mockAssistant: "المساعد:",
    mockMsg1: "كم سعر تنظيف الأسنان؟",
    mockMsg2: "سعر تنظيف الأسنان لدينا 250 ريال ويشمل الفحص والتنظيف. هل ترغب في طلب موعد؟",
    mockMsg3: "نعم، أريد طلب موعد",
    mockMsg4: "ممتاز! ما الوقت المناسب لك؟ سنرسل طلبك للعيادة لتأكيده.",
    mockQuickReplies: "ردود سريعة",
    mockChipMorning: "صباحاً",
    mockChipEvening: "مساءً",
    mockChipOther: "أخرى",
    mockInput: "اكتب رسالتك",
    mockNote: "السعر هنا للتوضيح فقط. يذكر المساعد أسعار عيادتك كما تُدخلها أنت.",

    // Features
    featuresKicker: "المميزات",
    featuresTitle: "ما يحتاجه الاستقبال ليرد بسرعة ودقة",
    featuresIntro: "يعمل المساعد إلى جانب فريقك، وتبقى القرارات بيد العيادة.",
    feature1Title: "ذكاء اصطناعي يفهم العربية",
    feature1Text:
      "يقرأ رسائل المرضى بالفصحى أو العامية، ويرد بعربية واضحة، أو بالإنجليزية إذا كتب المريض بها.",
    feature2Title: "تكامل رسمي مع واتساب للأعمال",
    feature2Text:
      "يعمل عبر منصة واتساب للأعمال من Meta برقم عيادتك بعد توثيقه، إلى جانب محادثة على موقعك.",
    feature3Title: "ردود من معلومات عيادتك المعتمدة فقط",
    feature3Text:
      "يجيب من الخدمات والأسعار والأسئلة التي تعتمدها العيادة، وإن لم يجد الجواب قال ذلك بوضوح.",
    feature4Title: "إدارة طلبات المواعيد",
    feature4Text:
      "يجمع الاسم ورقم الجوال والخدمة والوقت المفضل، ويضع الطلب في لوحة التحكم ليؤكده فريقك.",
    feature5Title: "تحويل الحالات الطبية للموظف",
    feature5Text:
      "لا يشخّص ولا يصف علاجاً. يحوّل الأسئلة الطبية والشكاوى وطلبات التحدث مع موظف إلى فريقك.",
    feature6Title: "تقارير من بيانات حقيقية",
    feature6Text:
      "أرقام لوحة التحكم محسوبة من محادثات عيادتك وطلباتها الفعلية، دون تقديرات أو أرقام افتراضية.",

    // How it works
    howKicker: "كيف يعمل",
    howTitle: "من رسالة المريض إلى موعد يؤكده فريقك",
    howIntro: "أربع خطوات واضحة، والكلمة الأخيرة دائماً لفريق عيادتك.",
    howNote:
      "المواعيد يؤكدها فريق العيادة. المساعد لا يؤكد أي موعد بنفسه، وما يسجّله يبقى طلباً حتى يؤكده موظف.",
    howStep: "الخطوة {n}",
    step1Title: "المريض يتواصل عبر واتساب أو محادثة الموقع",
    step1Text:
      "يكتب المريض سؤاله في أي وقت، على رقم عيادتك في واتساب أو في صفحة المحادثة الخاصة بعيادتك.",
    step2Title: "المساعد يجيب من الخدمات والأسعار والأسئلة التي اعتمدتها العيادة",
    step2Text: "لا يخترع أسعاراً أو خدمات. إذا لم يجد الجواب في معلومات عيادتك أخبر المريض بذلك.",
    step3Title: "يسجّل طلب الموعد أو يحوّل المحادثة للموظف",
    step3Text:
      "يجمع بيانات الطلب، أو يوقف ردوده الآلية ويحوّل المحادثة لفريقك عند سؤال طبي أو شكوى أو طلب التحدث مع موظف.",
    step4Title: "الاستقبال يؤكد الموعد ويتابع من لوحة التحكم",
    step4Text:
      "يرى فريقك الطلبات والمحادثات المحوّلة في مكان واحد، فيتواصل مع المريض ويؤكد الموعد أو يقترح وقتاً آخر.",
    actorPatient: "المريض",
    actorAssistant: "المساعد",
    actorReception: "الاستقبال",

    // Audiences
    audKicker: "لمن صُمّم",
    audTitle: "لأي العيادات؟",
    audIntro:
      "للعيادات التي تتلقى كل يوم أسئلة متكررة عن الخدمات والأسعار، وتريد طلبات المواعيد في مكان واحد.",
    audDental: "عيادات الأسنان",
    audDentalNote: "أسعار التنظيف والتبييض والتقويم وطلبات الكشف",
    audDerma: "عيادات الجلدية",
    audDermaNote: "الاستفسار عن الجلسات والخدمات وطلب المواعيد",
    audCosmetic: "عيادات التجميل",
    audCosmeticNote: "أسئلة الإجراءات والسعر المعتمد لكل خدمة",
    audGeneral: "العيادات العامة",
    audGeneralNote: "ساعات العمل والخدمات المتاحة وطلبات الزيارة",
    audCenters: "المراكز الطبية",
    audCentersNote: "عدة تخصصات وفريق استقبال يتابع من لوحة واحدة",

    // Interactive routing illustration
    demoKicker: "جرّب بنفسك",
    demoTitle: "جرّب كيف يتصرف المساعد",
    demoIntro: "اختر رسالة من مريض لترى المسار الذي يسلكه CliniBot.",
    demoDisclaimer: "رسم توضيحي ثابت لقواعد التوجيه، وليس محادثة حية مع الذكاء الاصطناعي.",
    demoPickLabel: "رسائل نموذجية من مرضى",
    demoMsgPrice: "بكم تبييض الأسنان عندكم؟",
    demoMsgBooking: "أبغى أحجز موعد يوم الأحد",
    demoMsgMedical: "أعاني من ألم في ضرسي، ماذا آخذ؟",
    demoMsgEmergency: "ألم شديد في الصدر",
    demoNodeIn: "رسالة المريض",
    demoNodeInEmpty: "اختر رسالة من القائمة",
    demoNodeBot: "CliniBot يقرأ الرسالة ويطبّق قواعد العيادة",
    demoRoutesLabel: "المسارات الممكنة",
    routeAnswer: "يجيب من المعلومات المعتمدة",
    routeBooking: "يسجّل طلب موعد لتؤكده العيادة",
    routeHandoff: "يحوّل للموظف دون نصيحة طبية",
    routeEmergency: "إرشاد طوارئ: اتصل على 997",
    demoResultTitle: "ما يحدث",
    demoIdle: "اختر رسالة لترى المسار وما يحدث بعدها.",
    demoSelected: "المسار المختار: {route}",
    resultAnswer:
      "يبحث في الخدمات والأسعار التي أدخلتها العيادة ويذكر السعر كما هو. إن لم يكن السعر مسجلاً، يقول إنه لا يملك المعلومة ويحوّل السؤال للاستقبال.",
    resultBooking:
      "يسأل عن الاسم ورقم الجوال والخدمة والوقت المفضل، ثم يسجّل طلباً في لوحة التحكم. يخبر المريض أن العيادة ستتواصل معه لتأكيد الموعد، ولا يؤكد الموعد بنفسه.",
    resultHandoff:
      "لا يقترح دواءً ولا يشخّص. يعتذر بلطف، ويوقف ردوده الآلية في هذه المحادثة، ويحوّلها لفريق العيادة مع ملخص قصير، ويقترح حجز استشارة.",
    resultEmergency:
      "تصل المريض فوراً رسالة ثابتة دون انتظار الذكاء الاصطناعي: اتصل على 997 أو توجّه لأقرب قسم طوارئ. ثم يُنبَّه فريق الاستقبال وتتوقف الردود الآلية.",

    // Pricing
    pricingKicker: "الأسعار",
    pricingTitle: "باقات واضحة بالريال السعودي",
    pricingNote:
      "أسعار مقترحة. ابدأ بتجربة مجانية لمدة 14 يوماً؛ الدفع الإلكتروني غير متاح بعد وسنتواصل معك لتفعيل الاشتراك.",
    pricingTrial: "تجربة مجانية لمدة 14 يوماً",
    pricingTrialLimit: "تتضمن التجربة عدداً محدوداً من الردود الآلية.",
    pricingMetaFees: "رسوم محادثات واتساب تفرضها Meta بشكل منفصل ولا تشملها هذه الأسعار.",
    pricingLoading: "جارٍ تحميل الباقات…",
    pricingEmpty: "لا توجد باقات منشورة حالياً. تواصل معنا لمعرفة الأسعار.",
    pricingPerMonth: "شهرياً",
    pricingExVat: "غير شامل ضريبة القيمة المضافة",
    pricingAiReplies: "الردود الآلية شهرياً",
    pricingSeats: "مستخدمو فريق العيادة",
    pricingCta: "ابدأ التجربة المجانية",

    // FAQ
    faqKicker: "الأسئلة الشائعة",
    faqTitle: "أسئلة تطرحها العيادات قبل البدء",
    faq1Q: "هل المساعد طبيب؟",
    faq1A:
      "لا. المساعد لا يشخّص ولا يصف أدوية أو علاجاً ولا يفسّر الأعراض أو التحاليل. عند أي سؤال طبي يعتذر بلطف ويحوّل المحادثة لفريق العيادة.",
    faq2Q: "هل يحجز المواعيد تلقائياً؟",
    faq2A:
      "لا. يسجّل طلب الموعد بالاسم ورقم الجوال والخدمة والوقت المفضل، ثم يؤكده فريق الاستقبال من لوحة التحكم. ويُبلَّغ المريض بأن طلبه وصل وأن العيادة ستتواصل معه للتأكيد.",
    faq3Q: "ماذا يحدث إذا لم يعرف الإجابة؟",
    faq3A:
      "يقول بوضوح إنه لا يملك هذه المعلومة، ويحوّل المحادثة للاستقبال أو يعطي رقم العيادة إن كان مسجلاً. وإذا تضمّن رد سعراً غير موجود في بيانات عيادتك، يُحجب الرد ويُحوَّل السؤال للموظف.",
    faq4Q: "هل الربط مع واتساب رسمي؟",
    faq4A:
      "نعم. يعمل عبر منصة واتساب للأعمال (WhatsApp Business Platform) من Meta. تحتاج العيادة إلى نشاط تجاري موثّق لدى Meta ورقم مسجّل على المنصة، وتفرض Meta رسوم المحادثات بشكل منفصل عن اشتراك CliniBot.",
    faq5Q: "أين تُحفظ البيانات؟",
    faq5A:
      "تُحفظ قاعدة البيانات على خوادم Supabase في فرانكفورت بألمانيا، أي خارج المملكة. تُولَّد الردود الآلية لدى Anthropic، وتمر رسائل واتساب عبر Meta. تحدد كل عيادة مدة الاحتفاظ بالبيانات، ويستطيع المريض حذف بياناته في أي وقت. التفاصيل في سياسة الخصوصية.",
    faq6Q: "هل يدعم العربية والإنجليزية؟",
    faq6A:
      "نعم. يرد بلغة المريض: بالعربية إذا كتب بالعربية، وبالإنجليزية إذا كتب بالإنجليزية. ولوحة التحكم متاحة باللغتين.",
    faq7Q: "هل أستطيع تعديل ما يقوله؟",
    faq7A:
      "نعم. أنت من يُدخل الخدمات والأسعار وساعات العمل والأسئلة الشائعة، وتختار اسم المساعد وأسلوبه ورسالة الترحيب وإشعار الخصوصية. وتستطيع تجربته من لوحة التحكم قبل تشغيله للمرضى.",
    faq8Q: "كم يستغرق الإعداد؟",
    faq8A:
      "إنشاء الحساب وإدخال معلومات العيادة وتجربة المساعد على محادثة الموقع يمكن إنجازها في جلسة واحدة. أما ربط واتساب فيعتمد على توثيق Meta لنشاطك التجاري، وقد يستغرق ذلك أياماً حسب Meta.",
    faqMore: "لم تجد إجابتك؟ {link}",
    faqMoreLink: "راسلنا من نموذج التواصل",

    // Contact and demo request
    contactKicker: "تواصل معنا",
    contactTitle: "اطلب عرضاً مجانياً",
    contactIntro: "اترك بياناتك وسنتواصل معك لنعرض عليك CliniBot بمعلومات عيادتك ونجيب عن أسئلتك.",
    contactStepsTitle: "ماذا يحدث بعد الإرسال؟",
    contactStep1: "نراجع طلبك.",
    contactStep2: "نتصل بك على الرقم الذي أدخلته لتحديد وقت مناسب.",
    contactStep3: "نعرض عليك المساعد وهو يجيب من معلومات عيادتك.",
    contactEmail: "أو راسلنا مباشرة على {email}",
    formTitle: "بيانات الطلب",
    formRequiredNote: "الحقول المعلّمة بنجمة مطلوبة.",
    fieldClinicName: "اسم العيادة",
    fieldContactName: "اسمك",
    fieldPhone: "رقم الجوال",
    fieldPhoneHint: "مثال: 05XXXXXXXX، أو رقم دولي يبدأ بـ +",
    fieldEmail: "البريد الإلكتروني",
    fieldCity: "المدينة",
    fieldClinicType: "نوع العيادة",
    fieldClinicTypePlaceholder: "اختر نوع العيادة",
    typeDental: "أسنان",
    typeDermatology: "جلدية",
    typeCosmetic: "تجميل",
    typeGeneral: "عامة",
    typePhysio: "علاج طبيعي",
    typeOther: "أخرى",
    fieldMessage: "رسالتك",
    fieldMessageHint: "مثلاً: عدد الفروع، أو الأسئلة التي تصلكم كثيراً.",
    consentLabel:
      "أوافق على أن يتواصل معي فريق CliniBot بخصوص هذا الطلب، وقد اطّلعت على {privacy}.",
    consentPrivacyLink: "سياسة الخصوصية",
    honeypotLabel: "اترك هذا الحقل فارغاً",
    submit: "أرسل الطلب",
    submitting: "جارٍ الإرسال…",
    successTitle: "وصلنا طلبك",
    successText: "شكراً لك. سنتواصل معك قريباً على الرقم الذي أدخلته.",
    successAnother: "إرسال طلب آخر",
    errClinicName: "اكتب اسم العيادة (حرفان على الأقل).",
    errContactName: "اكتب اسمك (حرفان على الأقل).",
    errPhoneRequired: "اكتب رقم الجوال.",
    errPhone: "أدخل رقم جوال صحيحاً، مثل 05XXXXXXXX، أو رقماً دولياً يبدأ بـ +.",
    errEmail: "أدخل بريداً إلكترونياً صحيحاً، أو اترك الحقل فارغاً.",
    errTooLong: "النص أطول من المسموح.",
    errMessageTooLong: "الرسالة أطول من 2000 حرف.",
    errClinicType: "اختر نوع العيادة من القائمة.",
    errConsent: "نحتاج موافقتك لنتمكن من التواصل معك.",
    errFormFields: "راجع الحقول المشار إليها ثم أرسل الطلب مرة أخرى.",
    errRateLimited:
      "وصلنا عدد كبير من الطلبات من هذا الاتصال خلال الساعة الأخيرة. انتظر قليلاً ثم حاول مرة أخرى.",
    errNetwork:
      "تعذّر إرسال الطلب لأن الاتصال انقطع. تحقّق من اتصالك ثم أعد المحاولة، فبياناتك ما زالت في النموذج.",

    // Final call to action and footer
    finalTitle: "ابدأ رحلتك نحو عيادة أذكى الآن",
    finalText: "جرّب CliniBot لمدة 14 يوماً مجاناً",
    finalCta: "ابدأ التجربة المجانية",
    footerDisclaimer: "CliniBot لا يقدم استشارات طبية.",
    footerEmergency: "في حالات الطوارئ اتصل على 997.",
    footerLinksLabel: "روابط",
    footerRights: "© {year} CliniBot. جميع الحقوق محفوظة.",
  },
  en: {
    metaTitle: "An AI receptionist for your clinic",

    navLabel: "Page sections",
    navHome: "Home",
    navFeatures: "Features",
    navHowItWorks: "How it works",
    navPricing: "Pricing",
    navFaq: "FAQ",
    navContact: "Contact",
    ctaStart: "Get started",
    ctaSignIn: "Sign in",
    ctaDashboard: "Dashboard",

    heroBadge: "Smart reception for the clinics of tomorrow",
    heroTitle: "A smart receptionist {clinic}",
    heroTitleEmphasis: "for your clinic",
    heroSubtitle:
      "It answers your patients' questions, explains your services, helps them request appointments, and hands conversations to your staff when needed, around the clock.",
    heroCtaDemo: "Request a demo",
    heroPointsLabel: "What it gives your clinic",
    heroPoint1: "Designed to protect patient data",
    heroPoint2: "Saves your front desk time",
    heroPoint3: "Organised appointment requests",

    mockLabel: "Example",
    mockCaption: "An example conversation between a patient and a clinic's assistant",
    mockClinic: "Your clinic",
    mockStatus: "Automated assistant",
    mockPatient: "Patient:",
    mockAssistant: "Assistant:",
    mockMsg1: "How much is a dental cleaning?",
    mockMsg2:
      "Our dental cleaning is 250 SAR and includes a check-up and the cleaning. Would you like to request an appointment?",
    mockMsg3: "Yes, I'd like to request an appointment",
    mockMsg4: "Great! What time suits you? We'll send your request to the clinic to confirm.",
    mockQuickReplies: "Quick replies",
    mockChipMorning: "Morning",
    mockChipEvening: "Evening",
    mockChipOther: "Other",
    mockInput: "Type a message",
    mockNote:
      "The price here is for illustration. The assistant quotes your prices as you enter them.",

    featuresKicker: "Features",
    featuresTitle: "What your front desk needs to reply quickly and accurately",
    featuresIntro: "The assistant works alongside your team, and decisions stay with the clinic.",
    feature1Title: "AI that understands Arabic",
    feature1Text:
      "Reads patients' messages in formal or everyday Arabic and replies in clear Arabic, or in English when the patient writes in English.",
    feature2Title: "Official WhatsApp Business integration",
    feature2Text:
      "Runs on Meta's WhatsApp Business Platform with your clinic's verified number, plus a chat on your website.",
    feature3Title: "Answers only from your approved information",
    feature3Text:
      "Answers from the services, prices and FAQs your clinic approves. If the answer isn't there, it says so.",
    feature4Title: "Appointment request management",
    feature4Text:
      "Collects the name, mobile number, service and preferred time, and puts the request in your dashboard for your team to confirm.",
    feature5Title: "Medical questions go to your staff",
    feature5Text:
      "It never diagnoses or suggests treatment. Medical questions, complaints and requests for a person go to your team.",
    feature6Title: "Reports from real data",
    feature6Text:
      "Dashboard figures are counted from your clinic's actual conversations and requests, with no estimates or sample numbers.",

    howKicker: "How it works",
    howTitle: "From a patient's message to an appointment your team confirms",
    howIntro: "Four clear steps, and the final say always rests with your clinic's team.",
    howNote:
      "Appointments are confirmed by your clinic's team. The assistant never confirms a booking itself; what it records stays a request until a staff member confirms it.",
    howStep: "Step {n}",
    step1Title: "The patient writes on WhatsApp or your website chat",
    step1Text:
      "Patients write any time, to your clinic's WhatsApp number or on your clinic's chat page.",
    step2Title: "The assistant answers from the services, prices and FAQs your clinic approved",
    step2Text:
      "It never invents prices or services. If the answer isn't in your clinic's information, it tells the patient.",
    step3Title: "It records the appointment request or hands the chat to staff",
    step3Text:
      "It collects the request details, or pauses its replies and passes the chat to your team for a medical question, a complaint or a request to speak to a person.",
    step4Title: "Reception confirms the appointment and follows up from the dashboard",
    step4Text:
      "Your team sees requests and handed-over chats in one place, contacts the patient, and confirms the appointment or suggests another time.",
    actorPatient: "Patient",
    actorAssistant: "Assistant",
    actorReception: "Reception",

    audKicker: "Who it's for",
    audTitle: "Which clinics is it for?",
    audIntro:
      "For clinics that get the same questions about services and prices every day and want appointment requests in one place.",
    audDental: "Dental clinics",
    audDentalNote: "Prices for cleaning, whitening and braces, and check-up requests",
    audDerma: "Dermatology clinics",
    audDermaNote: "Questions about sessions and services, and appointment requests",
    audCosmetic: "Cosmetic clinics",
    audCosmeticNote: "Questions about procedures and each service's approved price",
    audGeneral: "General practice clinics",
    audGeneralNote: "Working hours, available services and visit requests",
    audCenters: "Medical centres",
    audCentersNote: "Several specialties, with reception following up from one dashboard",

    demoKicker: "Try it",
    demoTitle: "See how the assistant responds",
    demoIntro: "Pick a patient message to see which path CliniBot takes.",
    demoDisclaimer: "A fixed illustration of the routing rules, not a live AI conversation.",
    demoPickLabel: "Sample patient messages",
    demoMsgPrice: "How much is teeth whitening at your clinic?",
    demoMsgBooking: "I'd like to book an appointment on Sunday",
    demoMsgMedical: "My tooth hurts, what should I take?",
    demoMsgEmergency: "Severe chest pain",
    demoNodeIn: "Patient's message",
    demoNodeInEmpty: "Choose a message from the list",
    demoNodeBot: "CliniBot reads the message and applies the clinic's rules",
    demoRoutesLabel: "Possible paths",
    routeAnswer: "Answers from approved information",
    routeBooking: "Records a request for the clinic to confirm",
    routeHandoff: "Hands over to staff, no medical advice",
    routeEmergency: "Emergency guidance: call 997",
    demoResultTitle: "What happens",
    demoIdle: "Choose a message to see the path and what happens next.",
    demoSelected: "Chosen path: {route}",
    resultAnswer:
      "It looks up the services and prices your clinic entered and quotes the price exactly. If the price isn't listed, it says it doesn't have that information and passes the question to reception.",
    resultBooking:
      "It asks for the name, mobile number, service and preferred time, then records a request in the dashboard. It tells the patient the clinic will contact them to confirm, and never confirms the appointment itself.",
    resultHandoff:
      "It suggests no medicine and makes no diagnosis. It apologises politely, pauses its replies in this conversation, hands it to the clinic's team with a short summary, and suggests booking a consultation.",
    resultEmergency:
      "A fixed message goes out right away, without waiting for the AI: call 997 or go to the nearest emergency department. Reception is then alerted and automated replies stop.",

    pricingKicker: "Pricing",
    pricingTitle: "Clear plans in Saudi riyals",
    pricingNote:
      "Proposed prices. Start with a 14-day free trial. Online payment isn't available yet; we'll contact you to activate your subscription.",
    pricingTrial: "14-day free trial",
    pricingTrialLimit: "The trial includes a limited number of AI replies.",
    pricingMetaFees:
      "WhatsApp conversation fees are charged separately by Meta and aren't included in these prices.",
    pricingLoading: "Loading plans…",
    pricingEmpty: "No plans are published right now. Contact us for pricing.",
    pricingPerMonth: "per month",
    pricingExVat: "excluding VAT",
    pricingAiReplies: "AI replies per month",
    pricingSeats: "Clinic staff users",
    pricingCta: "Start free trial",

    faqKicker: "FAQ",
    faqTitle: "Questions clinics ask before starting",
    faq1Q: "Is the assistant a doctor?",
    faq1A:
      "No. It doesn't diagnose, prescribe or interpret symptoms or test results. For any medical question it apologises politely and hands the conversation to your clinic's team.",
    faq2Q: "Does it book appointments automatically?",
    faq2A:
      "No. It records the request with the name, mobile number, service and preferred time, and your reception team confirms it from the dashboard. The patient is told the request was received and the clinic will contact them to confirm.",
    faq3Q: "What if it doesn't know the answer?",
    faq3A:
      "It says plainly that it doesn't have that information and hands the chat to reception, or shares the clinic's phone number if you've added it. If a reply mentions a price that isn't in your clinic's data, the reply is withheld and the question goes to staff.",
    faq4Q: "Is the WhatsApp connection official?",
    faq4A:
      "Yes. It uses Meta's WhatsApp Business Platform. Your clinic needs a business verified by Meta and a number registered on the platform, and Meta charges conversation fees separately from your CliniBot subscription.",
    faq5Q: "Where is the data stored?",
    faq5A:
      "The database is hosted by Supabase on servers in Frankfurt, Germany, which is outside the Kingdom. AI replies are generated by Anthropic, and WhatsApp messages travel through Meta. Each clinic sets how long data is kept, and patients can delete their data at any time. The privacy policy has the details.",
    faq6Q: "Does it support Arabic and English?",
    faq6A:
      "Yes. It replies in the patient's language: Arabic when they write in Arabic, English when they write in English. The dashboard is available in both languages.",
    faq7Q: "Can I edit what it says?",
    faq7A:
      "Yes. You enter the services, prices, working hours and FAQs, and you choose the assistant's name, tone, welcome message and privacy notice. You can test it from the dashboard before turning it on for patients.",
    faq8Q: "How long does setup take?",
    faq8A:
      "Creating the account, adding your clinic's information and testing the assistant on the website chat can be done in one sitting. Connecting WhatsApp depends on Meta verifying your business, which can take days and is up to Meta.",
    faqMore: "Didn't find your answer? {link}",
    faqMoreLink: "Write to us using the contact form",

    contactKicker: "Contact us",
    contactTitle: "Request a free demo",
    contactIntro:
      "Leave your details and we'll contact you to show you CliniBot with your clinic's information and answer your questions.",
    contactStepsTitle: "What happens after you send it?",
    contactStep1: "We review your request.",
    contactStep2: "We call you on the number you gave us to find a suitable time.",
    contactStep3: "We show you the assistant answering from your clinic's information.",
    contactEmail: "Or email us directly at {email}",
    formTitle: "Request details",
    formRequiredNote: "Fields marked with an asterisk are required.",
    fieldClinicName: "Clinic name",
    fieldContactName: "Your name",
    fieldPhone: "Mobile number",
    fieldPhoneHint: "For example 05XXXXXXXX, or an international number starting with +",
    fieldEmail: "Email",
    fieldCity: "City",
    fieldClinicType: "Clinic type",
    fieldClinicTypePlaceholder: "Choose a clinic type",
    typeDental: "Dental",
    typeDermatology: "Dermatology",
    typeCosmetic: "Cosmetic",
    typeGeneral: "General practice",
    typePhysio: "Physiotherapy",
    typeOther: "Other",
    fieldMessage: "Your message",
    fieldMessageHint: "For example, how many branches you have, or the questions you get most.",
    consentLabel:
      "I agree that the CliniBot team may contact me about this request, and I have read the {privacy}.",
    consentPrivacyLink: "privacy policy",
    honeypotLabel: "Leave this field empty",
    submit: "Send request",
    submitting: "Sending…",
    successTitle: "We've received your request",
    successText: "Thank you. We'll contact you soon on the number you gave us.",
    successAnother: "Send another request",
    errClinicName: "Enter the clinic's name (at least 2 characters).",
    errContactName: "Enter your name (at least 2 characters).",
    errPhoneRequired: "Enter a mobile number.",
    errPhone:
      "Enter a valid mobile number, like 05XXXXXXXX, or an international number starting with +.",
    errEmail: "Enter a valid email address, or leave the field empty.",
    errTooLong: "This text is longer than allowed.",
    errMessageTooLong: "The message is longer than 2000 characters.",
    errClinicType: "Choose a clinic type from the list.",
    errConsent: "We need your agreement before we can contact you.",
    errFormFields: "Check the highlighted fields, then send the request again.",
    errRateLimited:
      "We've received many requests from this connection in the last hour. Wait a while, then try again.",
    errNetwork:
      "We couldn't send your request because the connection failed. Check your connection and try again; your details are still in the form.",

    finalTitle: "Start your journey to a smarter clinic today",
    finalText: "Try CliniBot free for 14 days",
    finalCta: "Start your free trial",
    footerDisclaimer: "CliniBot does not provide medical advice.",
    footerEmergency: "In an emergency, call 997.",
    footerLinksLabel: "Links",
    footerRights: "© {year} CliniBot. All rights reserved.",
  },
} satisfies Namespace;
