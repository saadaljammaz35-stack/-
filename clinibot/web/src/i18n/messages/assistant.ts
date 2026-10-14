import type { Namespace } from "../types";

export default {
  ar: {
    title: "المساعد الذكي",
    description:
      "حالة المساعد، وتفعيله للمرضى، وتجربته قبل التشغيل، وطريقة تقديمه لنفسه وأسلوب رده.",
    copyFailed: "تعذّر النسخ. حدّد النص وانسخه يدوياً.",
    unknown: "غير معروف",
    refreshStatus: "تحديث الحالة",
    managersOnly: "التعديل متاح لمالك العيادة أو مديرها فقط.",
    goToBilling: "الذهاب إلى صفحة الاشتراك",

    // Not configured
    notConfiguredTitle: "الذكاء الاصطناعي غير مُعدّ بعد",
    notConfiguredText:
      "لم يُضف مفتاح خدمة الذكاء الاصطناعي على خادم المنصة، لذلك لا يستطيع المساعد الرد على أحد، ولا يمكن تجربته أو تفعيله. هذا الإعداد مسؤولية مشغّل منصة CliniBot وليس العيادة.",
    notConfiguredStep1: "يضيف مشغّل المنصة المفتاح السري {secret} من {path}.",
    notConfiguredPath: "لوحة Supabase ← Edge Functions ← Secrets",
    notConfiguredStep2: "الخطوات التفصيلية موجودة في الملف {doc} (قسم أسرار Edge Functions).",
    notConfiguredStep3: "بعد إضافة المفتاح، ارجع إلى هذه الصفحة واضغط «تحديث الحالة».",
    notConfiguredStep4:
      "أرسل رسالة تجريبية من قسم «تجربة المساعد». عند نجاح التجربة يصبح تفعيل المساعد للمرضى متاحاً.",
    notConfiguredMeanwhile:
      "حتى ذلك الحين تبقى المحادثة على الموقع متاحة إن كانت مفعّلة، وتصل رسائل المرضى إلى فريق الاستقبال للرد عليها.",

    // States
    statusTitle: "حالة المساعد",
    stateNotConfigured: "غير مُعدّ",
    stateNotConfiguredText: "لا يرد المساعد على المرضى لأن الذكاء الاصطناعي غير مُعدّ على الخادم.",
    stateNotTested: "لم تُجرَ تجربة بعد",
    stateNotTestedText:
      "الذكاء الاصطناعي مُعدّ، لكن لم تُجرَ أي تجربة ناجحة بعد. جرّب المساعد أولاً، ثم فعّله للمرضى.",
    stateTestFailed: "فشلت آخر تجربة",
    stateTestFailedText:
      "لم تنجح آخر تجربة بسبب خطأ من مزوّد الذكاء الاصطناعي. أعد التجربة؛ لا يمكن تفعيل المساعد قبل نجاحها.",
    stateTestExpired: "يلزم إعادة التجربة",
    stateTestExpiredText:
      "مرّ أكثر من 30 يوماً على آخر تجربة ناجحة. أعد التجربة لتتمكّن من تفعيل المساعد.",
    stateReady: "جاهز، لكنه متوقف",
    stateReadyText:
      "نجحت التجربة والمساعد جاهز، لكنه متوقف حالياً ولا يرد على المرضى. فعّله من قسم «التفعيل».",
    stateActive: "يعمل ويرد على المرضى",
    stateActiveText:
      "المساعد مفعّل ونجحت آخر تجربة له. يرد على المرضى ضمن قنوات العيادة المتاحة.",
    stateEnabledFailing: "مفعّل، لكن آخر تجربة لم تنجح",
    stateEnabledFailingText:
      "المساعد مفعّل، لكن لا توجد تجربة ناجحة حديثة تؤكد أنه يعمل. أعد التجربة الآن، وإن استمر الفشل فأوقفه وتواصل مع الدعم.",
    statusModel: "النموذج المستخدم",
    statusEnabled: "التفعيل للمرضى",
    switchedOn: "مفعّل",
    switchedOff: "متوقف",
    statusLastTest: "آخر تجربة",
    neverTested: "لم تُجرَ بعد",
    statusLastResult: "نتيجة آخر تجربة",
    testPassed: "نجحت",
    testFailedShort: "فشلت",
    noResult: "لا توجد نتيجة",
    statusUsage: "ردود الذكاء الاصطناعي هذا الشهر",
    usageValue: "{used} من {limit}",
    subscriptionInactiveTitle: "الاشتراك غير نشط",
    subscriptionInactiveText:
      "اشتراك العيادة غير نشط، لذلك لن يرد المساعد على المرضى ولا يمكن تجربته حتى يُفعَّل الاشتراك.",
    quotaExhaustedTitle: "استُنفد رصيد هذا الشهر",
    quotaExhaustedText:
      "استُخدمت جميع ردود الذكاء الاصطناعي المتاحة في باقتك لهذا الشهر. لن يرد المساعد حتى يتجدد الرصيد أو تُرقّى الباقة، وتصل الرسائل إلى فريق الاستقبال.",

    // Activation
    activationTitle: "التفعيل",
    activationDescription: "ما يراه المرضى: ردود المساعد، ورابط المحادثة على الموقع.",
    settingsMissing: "تعذّر العثور على إعدادات العيادة. حدّث الصفحة أو تواصل مع الدعم.",
    enableLabel: "المساعد يرد على المرضى",
    enabledHint:
      "المساعد يرد الآن على رسائل المرضى. عند إيقافه تصل الرسائل إلى فريق الاستقبال دون رد آلي.",
    enableUnknown: "جارٍ التحقق من حالة الذكاء الاصطناعي…",
    enableNeedsConfig: "لا يمكن التفعيل قبل إعداد الذكاء الاصطناعي على الخادم.",
    enableNeedsTest:
      "لا يمكن التفعيل إلا بعد تجربة ناجحة خلال آخر {days} يوماً. استخدم «تجربة المساعد» أولاً.",
    enableReady: "نجحت التجربة. عند التفعيل يبدأ المساعد بالرد على رسائل المرضى.",
    notTestedError:
      "لم يُفعَّل المساعد: يلزم تجربة ناجحة خلال آخر {days} يوماً. أرسل رسالة من «تجربة المساعد»، ثم أعد المحاولة.",
    publicChatLabel: "المحادثة على الموقع",
    publicChatHint:
      "يتيح للمرضى مراسلة العيادة عبر الرابط أدناه. إن كان المساعد متوقفاً تصل الرسائل إلى فريق الاستقبال.",
    patientLink: "رابط المحادثة للمرضى",
    copyPatientLink: "نسخ رابط المحادثة للمرضى",
    openLink: "فتح",
    patientLinkOn: "شارك هذا الرابط في موقع العيادة أو حساباتها على وسائل التواصل.",
    patientLinkOff: "الرابط لن يعمل للمرضى حتى تفعّل {strong}.",

    // Settings
    settingsTitle: "أسلوب المساعد",
    settingsDescription: "كيف يعرّف المساعد بنفسه ويرحّب بالمرضى، وأي إرشادات إضافية من العيادة.",
    settingsReadOnly: "تستطيع الاطلاع على الإعدادات، أما تعديلها فمتاح لمالك العيادة أو مديرها فقط.",
    fieldName: "اسم المساعد",
    fieldNameHint: "الاسم الذي يعرّف به المساعد نفسه، حتى {max} حرفاً.",
    fieldTone: "أسلوب الرد",
    toneFriendly: "ودود",
    toneFormal: "رسمي",
    fieldWelcomeAr: "رسالة الترحيب بالعربية",
    fieldWelcomeEn: "رسالة الترحيب بالإنجليزية",
    charCount: "{count} من {max} حرف",
    fieldInstructions: "إرشادات إضافية للمساعد",
    fieldInstructionsHint:
      "مثل: «ذكّر المريض بإحضار بطاقة التأمين» أو «لا نستقبل الأطفال دون 5 سنوات».",
    safetyTitle: "قواعد السلامة ثابتة ولا تتغير بهذه الإرشادات:",
    safetyNoDiagnosis: "لا يشخّص المساعد ولا يقدّم نصيحة طبية، ويحوّل الأسئلة الطبية إلى الفريق.",
    safetyNoPrices: "لا يذكر سعراً غير مسجّل في الخدمات أو الأسئلة الشائعة.",
    safetyRequestsOnly: "يسجّل طلبات مواعيد فقط، ولا يؤكد أي موعد؛ التأكيد من فريق العيادة.",
    safetyEmergency: "في الحالات الطارئة يوجّه المريض فوراً إلى رقم الطوارئ.",
    fieldEmergency: "رقم الطوارئ",
    fieldEmergencyHint: "أرقام فقط. الرقم الموحد للطوارئ في السعودية هو 997.",
    unsavedChanges: "لديك تغييرات غير محفوظة.",
    discardChanges: "تراجع",
    settingsSaved: "حُفظت إعدادات المساعد.",
    errName: "اكتب اسماً للمساعد، حتى {max} حرفاً.",
    errTone: "اختر أسلوب الرد.",
    errTooLong: "النص أطول من الحد المسموح ({max} حرف).",
    errEmergency: "رقم الطوارئ أرقام فقط، من {min} إلى {max} خانة.",

    // Outcomes
    outcomeAnswered: "أجاب",
    outcomeAnsweredText: "أجاب المساعد من معلومات العيادة دون الحاجة إلى تدخل الفريق.",
    outcomeHandoff: "تحويل إلى الفريق",
    outcomeHandoffText:
      "طلب المساعد تدخل فريق العيادة. في المحادثات الحقيقية تُحوَّل المحادثة إلى الفريق ويتوقف الرد الآلي فيها.",
    outcomeEmergency: "حالة طارئة",
    outcomeEmergencyText:
      "رُصدت علامات حالة طارئة، فوجّه المريض إلى رقم الطوارئ مباشرةً دون استخدام الذكاء الاصطناعي.",
    outcomeBlockedPrice: "حُجب سعر غير معتمد",
    outcomeBlockedPriceText:
      "ذكر الرد سعراً غير مسجّل في معلومات العيادة، فحُجب واستُبدل برد آمن. أضف السعر إلى الخدمات إن كان صحيحاً.",
    outcomeRefused: "اعتذر عن الإجابة",
    outcomeRefusedText:
      "امتنع الذكاء الاصطناعي عن الإجابة، فأُرسل رد آمن. في المحادثات الحقيقية تُحوَّل المحادثة إلى الفريق.",
    reasonMedical: "سؤال طبي",
    reasonComplaint: "شكوى",
    reasonUnknown: "معلومة غير متوفرة",
    reasonCustomerRequest: "طلب المريض التحدث مع موظف",
    reasonBookingHelp: "مساعدة في الحجز",
    reasonOther: "سبب آخر",
    windowMorning: "صباحاً",
    windowAfternoon: "بعد الظهر",
    windowEvening: "مساءً",
    windowAny: "أي وقت",

    // Test reply
    handoffReason: "سبب التحويل: {reason}",
    appointmentTitle: "طلب موعد (تجربة، لم يُحفظ)",
    appointmentName: "الاسم",
    appointmentService: "الخدمة",
    appointmentDate: "التاريخ المفضّل",
    appointmentWindow: "الوقت المفضّل",
    appointmentNotSaved:
      "في المحادثات الحقيقية يُسجَّل هذا الطلب في صفحة المواعيد ليؤكده الفريق. في التجربة لا يُحفظ شيء.",
    notProvided: "غير محدد",
    unknownService: "خدمة غير موجودة في القائمة",
    noModelCall: "لم يُستدعَ الذكاء الاصطناعي لهذه الرسالة، ولم تُحتسب من الرصيد.",
    usageLine: "النموذج: {model} · الرموز: {input} إدخال، {output} إخراج ({cached} من الذاكرة المؤقتة)",

    // Test errors
    testBillingTitle: "لا يمكن التجربة الآن",
    testBillingText: "راجع حالة الاشتراك والرصيد في صفحة الاشتراك.",
    upstreamTitle: "خطأ من مزوّد الذكاء الاصطناعي",
    upstreamText:
      "لم يُرجع مزوّد الذكاء الاصطناعي رداً صالحاً. حاول مرة أخرى بعد قليل، وإن تكرر الخطأ فأرسل رقم المرجع للدعم.",
    rateLimitedTitle: "تمهّل قليلاً",

    // Test console
    testTitle: "تجربة المساعد",
    testDescription:
      "اكتب كما يكتب المريض. يرد المساعد فعلياً من بيانات العيادة المحفوظة، لكن لا تُحفظ المحادثة ولا تُنشأ طلبات مواعيد ولا يُراسَل أي مريض.",
    testClear: "محادثة جديدة",
    testAllowanceNote:
      "كل رسالة تجربة تُعدّ رداً حقيقياً من الذكاء الاصطناعي وتُحتسب من رصيد الردود الشهري للعيادة.",
    testAllowanceUsage: "المستخدم هذا الشهر: {used} من {limit}.",
    testBlockedConfig: "لا يمكن التجربة قبل إعداد الذكاء الاصطناعي. اتبع الخطوات الموضحة أعلى الصفحة.",
    testLogLabel: "محادثة التجربة",
    testEmpty: "ابدأ برسالة من عندك أو اختر أحد الأمثلة أدناه لترى كيف يرد المساعد.",
    youSaid: "أنت:",
    assistantSaid: "المساعد:",
    testThinking: "المساعد يكتب ردّه…",
    testWindowNote: "تُرسل آخر {max} رسالة فقط إلى المساعد. ابدأ محادثة جديدة لاختبار سيناريو آخر.",
    testSuggestions: "أمثلة للتجربة",
    testInputLabel: "رسالة التجربة",
    testSend: "إرسال",
    testInputHint: "{count} من {max} حرف",
    testManagersOnly:
      "تجربة المساعد متاحة لمالك العيادة أو مديرها، لأن كل رسالة تُحتسب من رصيد ردود الذكاء الاصطناعي.",
    chipPrice: "سؤال عن سعر",
    promptPrice: "كم سعر تنظيف الأسنان عندكم؟",
    chipHours: "مواعيد العمل",
    promptHours: "متى تفتحون يوم الخميس؟ وهل تداومون الجمعة؟",
    chipBooking: "طلب موعد",
    promptBooking: "أبغى أحجز موعد يوم الأحد الصباح، اسمي سارة.",
    chipMedical: "سؤال طبي",
    promptMedical: "عندي ألم في ضرسي من يومين، وش السبب؟ وهل آخذ مضاد حيوي؟",
    chipEmergency: "حالة طارئة",
    promptEmergency: "أبوي عنده ألم شديد في الصدر وضيق في التنفس، وش أسوي؟",
  },
  en: {
    title: "AI assistant",
    description:
      "The assistant's status, switching it on for patients, testing it first, and how it introduces itself and replies.",
    copyFailed: "Couldn't copy. Select the text and copy it manually.",
    unknown: "Unknown",
    refreshStatus: "Refresh status",
    managersOnly: "Only the clinic's owner or an admin can change this.",
    goToBilling: "Go to billing",

    // Not configured
    notConfiguredTitle: "AI isn't set up yet",
    notConfiguredText:
      "The platform server has no AI service key, so the assistant can't reply to anyone and can't be tested or switched on. This is set up by the CliniBot platform operator, not by the clinic.",
    notConfiguredStep1: "The platform operator adds the {secret} secret under {path}.",
    notConfiguredPath: "Supabase dashboard → Edge Functions → Secrets",
    notConfiguredStep2: "Detailed steps are in {doc} (the Edge Function secrets section).",
    notConfiguredStep3: "Once the key is added, come back to this page and press “Refresh status”.",
    notConfiguredStep4:
      "Send a test message in “Test the assistant”. When a test succeeds, you can switch the assistant on for patients.",
    notConfiguredMeanwhile:
      "Until then, web chat keeps working if it's switched on, and patients' messages reach reception to answer.",

    // States
    statusTitle: "Assistant status",
    stateNotConfigured: "Not set up",
    stateNotConfiguredText: "The assistant doesn't reply to patients because AI isn't set up on the server.",
    stateNotTested: "Not tested yet",
    stateNotTestedText:
      "AI is set up, but there hasn't been a successful test yet. Test the assistant first, then switch it on for patients.",
    stateTestFailed: "Last test failed",
    stateTestFailedText:
      "The last test failed because of an error from the AI provider. Test again; the assistant can't be switched on until a test succeeds.",
    stateTestExpired: "Test again",
    stateTestExpiredText:
      "The last successful test was more than 30 days ago. Test again to be able to switch the assistant on.",
    stateReady: "Ready, but switched off",
    stateReadyText:
      "The test succeeded and the assistant is ready, but it's switched off and isn't replying to patients. Switch it on under “Activation”.",
    stateActive: "On and replying to patients",
    stateActiveText:
      "The assistant is switched on and its last test succeeded. It replies to patients on the clinic's available channels.",
    stateEnabledFailing: "On, but the last test didn't succeed",
    stateEnabledFailingText:
      "The assistant is switched on, but there's no recent successful test confirming it works. Test it now; if it keeps failing, switch it off and contact support.",
    statusModel: "Model",
    statusEnabled: "Switched on for patients",
    switchedOn: "On",
    switchedOff: "Off",
    statusLastTest: "Last test",
    neverTested: "Not yet",
    statusLastResult: "Last test result",
    testPassed: "Passed",
    testFailedShort: "Failed",
    noResult: "No result",
    statusUsage: "AI replies this month",
    usageValue: "{used} of {limit}",
    subscriptionInactiveTitle: "Subscription inactive",
    subscriptionInactiveText:
      "The clinic's subscription isn't active, so the assistant won't reply to patients and can't be tested until it's reactivated.",
    quotaExhaustedTitle: "This month's allowance is used up",
    quotaExhaustedText:
      "All AI replies included in your plan this month have been used. The assistant won't reply until the allowance renews or the plan is upgraded; messages still reach reception.",

    // Activation
    activationTitle: "Activation",
    activationDescription: "What patients get: assistant replies, and the web chat link.",
    settingsMissing: "The clinic's settings couldn't be found. Reload the page or contact support.",
    enableLabel: "Assistant replies to patients",
    enabledHint:
      "The assistant is replying to patients now. When it's off, messages reach reception without an automatic reply.",
    enableUnknown: "Checking the AI status…",
    enableNeedsConfig: "This can't be switched on until AI is set up on the server.",
    enableNeedsTest:
      "This can only be switched on after a successful test in the last {days} days. Use “Test the assistant” first.",
    enableReady: "The test succeeded. When switched on, the assistant starts replying to patients.",
    notTestedError:
      "The assistant wasn't switched on: it needs a successful test in the last {days} days. Send a message in “Test the assistant”, then try again.",
    publicChatLabel: "Web chat",
    publicChatHint:
      "Lets patients message the clinic through the link below. If the assistant is off, messages reach reception.",
    patientLink: "Patient chat link",
    copyPatientLink: "Copy the patient chat link",
    openLink: "Open",
    patientLinkOn: "Share this link on the clinic's website or social media accounts.",
    patientLinkOff: "The link won't work for patients until you switch on {strong}.",

    // Settings
    settingsTitle: "Assistant style",
    settingsDescription:
      "How the assistant introduces itself and welcomes patients, plus any extra guidance from the clinic.",
    settingsReadOnly: "You can view these settings. Only the clinic's owner or an admin can change them.",
    fieldName: "Assistant name",
    fieldNameHint: "The name the assistant introduces itself with, up to {max} characters.",
    fieldTone: "Tone",
    toneFriendly: "Friendly",
    toneFormal: "Formal",
    fieldWelcomeAr: "Welcome message in Arabic",
    fieldWelcomeEn: "Welcome message in English",
    charCount: "{count} of {max} characters",
    fieldInstructions: "Extra guidance for the assistant",
    fieldInstructionsHint:
      "For example: “Remind patients to bring their insurance card” or “We don't see children under 5.”",
    safetyTitle: "These safety rules are fixed and can't be changed by guidance:",
    safetyNoDiagnosis:
      "The assistant doesn't diagnose or give medical advice; medical questions go to your team.",
    safetyNoPrices: "It never quotes a price that isn't listed in services or FAQs.",
    safetyRequestsOnly:
      "It only records appointment requests and never confirms an appointment; your team confirms.",
    safetyEmergency: "In an emergency it immediately directs the patient to the emergency number.",
    fieldEmergency: "Emergency number",
    fieldEmergencyHint: "Digits only. Saudi Arabia's unified emergency number is 997.",
    unsavedChanges: "You have unsaved changes.",
    discardChanges: "Discard",
    settingsSaved: "Assistant settings saved.",
    errName: "Enter a name for the assistant, up to {max} characters.",
    errTone: "Choose a tone.",
    errTooLong: "This is longer than allowed ({max} characters).",
    errEmergency: "The emergency number must be {min} to {max} digits.",

    // Outcomes
    outcomeAnswered: "Answered",
    outcomeAnsweredText: "The assistant answered from the clinic's information without needing your team.",
    outcomeHandoff: "Handed to team",
    outcomeHandoffText:
      "The assistant asked for your team. In real conversations the chat is handed to your team and automatic replies stop in it.",
    outcomeEmergency: "Emergency",
    outcomeEmergencyText:
      "Emergency signs were detected, so the patient was directed to the emergency number straight away, without using AI.",
    outcomeBlockedPrice: "Unapproved price blocked",
    outcomeBlockedPriceText:
      "The reply quoted a price that isn't in the clinic's information, so it was withheld and replaced with a safe reply. Add the price to services if it's correct.",
    outcomeRefused: "Declined to answer",
    outcomeRefusedText:
      "The AI declined to answer, so a safe reply was sent. In real conversations the chat is handed to your team.",
    reasonMedical: "Medical question",
    reasonComplaint: "Complaint",
    reasonUnknown: "Information not available",
    reasonCustomerRequest: "Patient asked for a person",
    reasonBookingHelp: "Help with booking",
    reasonOther: "Other",
    windowMorning: "Morning",
    windowAfternoon: "Afternoon",
    windowEvening: "Evening",
    windowAny: "Any time",

    // Test reply
    handoffReason: "Handoff reason: {reason}",
    appointmentTitle: "Appointment request (test, not saved)",
    appointmentName: "Name",
    appointmentService: "Service",
    appointmentDate: "Preferred date",
    appointmentWindow: "Preferred time",
    appointmentNotSaved:
      "In real conversations this request is added to Appointments for your team to confirm. In a test nothing is saved.",
    notProvided: "Not given",
    unknownService: "A service not in your list",
    noModelCall: "AI wasn't called for this message, and it didn't count toward the allowance.",
    usageLine: "Model: {model} · Tokens: {input} in, {output} out ({cached} from cache)",

    // Test errors
    testBillingTitle: "Testing isn't available right now",
    testBillingText: "Check the subscription and allowance on the billing page.",
    upstreamTitle: "AI provider error",
    upstreamText:
      "The AI provider didn't return a usable reply. Try again shortly, and if it keeps happening send the reference to support.",
    rateLimitedTitle: "Slow down a little",

    // Test console
    testTitle: "Test the assistant",
    testDescription:
      "Write as a patient would. The assistant really replies from the clinic's saved information, but nothing is stored, no appointment requests are created and no patient is messaged.",
    testClear: "New conversation",
    testAllowanceNote:
      "Each test message is a real AI reply and counts toward the clinic's monthly reply allowance.",
    testAllowanceUsage: "Used this month: {used} of {limit}.",
    testBlockedConfig: "Testing isn't possible until AI is set up. Follow the steps at the top of the page.",
    testLogLabel: "Test conversation",
    testEmpty: "Start with your own message or pick an example below to see how the assistant replies.",
    youSaid: "You:",
    assistantSaid: "Assistant:",
    testThinking: "The assistant is writing a reply…",
    testWindowNote:
      "Only the last {max} messages are sent to the assistant. Start a new conversation to try another scenario.",
    testSuggestions: "Examples to try",
    testInputLabel: "Test message",
    testSend: "Send",
    testInputHint: "{count} of {max} characters",
    testManagersOnly:
      "Only the clinic's owner or an admin can test the assistant, because every message counts toward the AI reply allowance.",
    chipPrice: "Ask a price",
    promptPrice: "How much is teeth cleaning at your clinic?",
    chipHours: "Opening hours",
    promptHours: "When are you open on Thursday? Are you open on Friday?",
    chipBooking: "Book an appointment",
    promptBooking: "I'd like to book an appointment on Sunday morning. My name is Sarah.",
    chipMedical: "Medical question",
    promptMedical: "My tooth has hurt for two days. What's causing it? Should I take antibiotics?",
    chipEmergency: "Emergency",
    promptEmergency: "My father has severe chest pain and is short of breath. What should I do?",
  },
} satisfies Namespace;
