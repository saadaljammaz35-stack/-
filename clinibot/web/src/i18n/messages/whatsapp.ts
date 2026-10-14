import type { Namespace } from "../types";

export default {
  ar: {
    title: "واتساب",
    description:
      "ربط رقم واتساب للأعمال الخاص بالعيادة عبر منصة واتساب الرسمية من Meta، ليرد المساعد على المرضى ويستقبل الفريق رسائلهم.",
    refreshStatus: "تحديث الحالة",
    notYet: "لم يحدث بعد",
    none: "غير متوفر",

    // Status
    statusTitle: "حالة الربط",
    statusDisconnected: "غير مربوط",
    statusDisconnectedText: "لا يوجد رقم واتساب مربوط بالعيادة. لن تصل رسائل واتساب إلى CliniBot ولن يرد عليها المساعد.",
    statusCredentialsVerified: "تم التحقق من البيانات، بانتظار تحقق Meta من الـ Webhook",
    statusCredentialsVerifiedText:
      "قبلت Meta بيانات الربط، لكن لم يكتمل تحقق Meta من رابط الـ Webhook بعد. أكمل الخطوات في تطبيق Meta، وستتحدث الحالة تلقائياً.",
    statusConnected: "مربوط",
    statusConnectedText: "قبلت Meta بيانات الربط وأكملت التحقق من الـ Webhook. تصل رسائل واتساب إلى CliniBot.",
    statusError: "خطأ",
    statusErrorText:
      "فشل آخر طلب إلى Meta باستخدام بيانات الربط، ولا يُرسل CliniBot رسائل واتساب في هذه الحالة. راجع الخطأ، ثم اختبر الربط أو أدخل بيانات جديدة.",
    lastErrorTitle: "آخر خطأ من Meta",
    phoneNumber: "رقم الهاتف",
    verifiedName: "الاسم المعتمد",
    credentialsVerifiedAt: "التحقق من البيانات",
    webhookVerifiedAt: "تحقق Meta من الـ Webhook",
    lastInboundAt: "آخر رسالة واردة",
    callbackUrl: "رابط الاستدعاء (Callback URL)",
    copyCallbackUrl: "نسخ رابط الاستدعاء",
    callbackUrlHint: "هذا الرابط ليس سرياً، فكل طلب إليه يجب أن يحمل توقيع Meta الصحيح.",
    receptionistNote: "يدير مالك العيادة أو مديرها ربط واتساب وإعداداته.",
    qualityRating: "تقييم جودة الرقم لدى Meta",
    qualityHigh: "مرتفع",
    qualityMedium: "متوسط",
    qualityLow: "منخفض",
    qualityUnknown: "غير متوفر",

    // Credentials
    credentialsTitle: "بيانات الربط",
    credentialsDescription:
      "أدخل البيانات من تطبيق Meta. سيتحقق CliniBot منها لدى Meta أولاً، ولا يحفظ شيئاً إن رفضتها.",
    replaceTitle: "استبدال بيانات الربط",
    replaceDescription:
      "تحلّ البيانات الجديدة محل المحفوظة بعد أن تقبلها Meta. ستحتاج بعدها إلى إكمال تحقق الـ Webhook من جديد.",
    phoneNumberId: "معرّف رقم الهاتف (Phone number ID)",
    phoneNumberIdHint: "أرقام فقط، من صفحة WhatsApp ← API Setup. وهو غير رقم الهاتف نفسه.",
    wabaId: "معرّف حساب واتساب للأعمال (WABA ID)",
    wabaIdHint: "أرقام فقط، من نفس الصفحة.",
    accessToken: "رمز الوصول الدائم (Access token)",
    accessTokenHint:
      "رمز مستخدم النظام (System user) بصلاحيتي whatsapp_business_messaging و whatsapp_business_management. لا تستخدم الرمز المؤقت لمدة 24 ساعة.",
    appSecret: "المفتاح السري للتطبيق (App secret)",
    appSecretHint: "من إعدادات التطبيق ← Basic. يستخدمه CliniBot للتأكد أن كل رسالة واردة مصدرها Meta.",
    secretsNote:
      "يُرسَل رمز الوصول والمفتاح السري إلى الخادم مرة واحدة ويُحفظان مشفّرين، ولا يُعرضان مرة أخرى لأي أحد. لتغييرهما أدخلهما من جديد.",
    verifying: "جارٍ التحقق لدى Meta…",
    saveAndVerify: "حفظ والتحقق",
    encryptionMissingTitle: "ربط واتساب غير متاح على هذا الخادم بعد",
    encryptionMissingShort:
      "لم يضبط مشغّل المنصة مفتاح تشفير بيانات الربط، لذلك لا يمكن حفظ بيانات واتساب الآن. أبلغ مشغّل المنصة.",
    encryptionMissingText:
      "لم يضبط مشغّل المنصة المفتاح السري {secret}، لذلك لا يمكن حفظ بيانات واتساب بأمان. على مشغّل المنصة إضافته في Supabase ← Edge Functions ← Secrets كما في {doc}، ثم أعد المحاولة. لم يُحفظ شيء.",

    // Validation
    errRequired: "هذا الحقل مطلوب.",
    errDigits: "أرقام فقط، من {min} إلى {max} خانة.",
    errSecretChars: "يحتوي على مسافات أو رموز غير مسموحة. انسخه كما هو من Meta.",
    errLength: "الطول غير صحيح (من {min} إلى {max} حرفاً). تأكد من نسخه كاملاً.",
    errServerField: "رفض الخادم هذه القيمة. تأكد منها وأعد إدخالها.",
    errTemplateName: "اسم القالب أحرف إنجليزية صغيرة وأرقام وشرطة سفلية (_) فقط، كما يظهر في Meta.",
    errTemplateLanguage: "اختر لغة القالب.",

    // Connect errors
    metaRejectedTitle: "رفضت Meta الطلب",
    metaRejectedSave: "لم تقبل Meta هذه البيانات، ولم يُحفظ أي شيء. راجع البيانات وأعد إدخال رمز الوصول والمفتاح السري.",
    metaRejectedTest: "فشل اختبار الربط بالبيانات المحفوظة، وأصبحت حالة الربط «خطأ».",
    metaRejectedOther: "لم تُكمل Meta الطلب.",
    metaCode: "رمز خطأ Meta",
    metaMessage: "رسالة Meta",
    metaCode190:
      "الرمز 190 يعني أن رمز الوصول منتهي أو يفتقد الصلاحيات. أنشئ رمزاً دائماً لمستخدم النظام بالصلاحيات المطلوبة.",
    phoneInUseTitle: "الرقم مستخدم",
    phoneInUseText: "لا يمكن ربط رقم واحد بأكثر من عيادة. إن كان الرقم لعيادتك فتواصل مع الدعم.",

    // One-time reveal
    revealSavedTitle: "قبلت Meta البيانات. بقيت خطوة أخيرة في Meta",
    revealRotatedTitle: "أُنشئ رمز تحقق جديد",
    revealSavedText:
      "انسخ رابط الاستدعاء ورمز التحقق الآن وأدخلهما في تطبيق Meta. يصبح الربط «مربوطاً» بعد أن تتحقق Meta منهما.",
    revealRotatedText:
      "توقف الرمز السابق عن العمل. أدخل الرمز الجديد في تطبيق Meta واضغط Verify and save لإكمال التحقق مجدداً.",
    revealWarningTitle: "رمز التحقق يُعرض هذه المرة فقط",
    revealWarning:
      "لا يحفظ CliniBot رمز التحقق بصيغة قابلة للقراءة، ولن يُعرض مرة أخرى بعد إغلاق هذه اللوحة أو مغادرة الصفحة. إن فقدته فأنشئ رمزاً جديداً.",
    verifyToken: "رمز التحقق (Verify token)",
    copyVerifyToken: "نسخ رمز التحقق",
    appNotSubscribedTitle: "لم يُشترَك التطبيق في حساب واتساب للأعمال",
    appNotSubscribedText:
      "حاول CliniBot ربط تطبيقك بحساب واتساب للأعمال ولم ينجح. من دونه لن تصل الرسائل. اشترك من WhatsApp Manager أو أعد حفظ البيانات لاحقاً.",
    webhookStepsTitle: "الخطوات في تطبيق Meta (developers.facebook.com)",
    revealDone: "نسختهما، أغلق اللوحة",
    webhookStep1: "افتح تطبيقك في Meta ثم {path}.",
    webhookStep2: "الصق رابط الاستدعاء في {callback}، ورمز التحقق في {verify}.",
    webhookStep3: "اضغط {button}. ستتواصل Meta مع CliniBot للتحقق من الرمز.",
    webhookStep4: "تحت {fields} اشترك في الحقل {field} (يشمل أيضاً إشعارات التسليم والقراءة).",
    webhookStep5:
      "أرسل رسالة واتساب إلى رقم العيادة من هاتف آخر، وتأكد من ظهورها في صفحة المحادثات.",

    // Waiting for Meta
    waitingTitle: "بانتظار تحقق Meta من الـ Webhook",
    waitingDescription:
      "قبلت Meta بيانات الربط. لن يصبح الربط «مربوطاً» حتى تكمل هذه الخطوات في تطبيق Meta. تتحدث هذه الصفحة تلقائياً.",
    waitingLostToken:
      "لم يعد رمز التحقق معك؟ لا يمكن عرضه مرة أخرى، لكن يمكنك إنشاء رمز جديد من «إنشاء رمز تحقق جديد» أدناه.",

    // Setup checklist
    checklistTitle: "ما تحتاجه العيادة من Meta",
    checklistDescription: "إعداد لمرة واحدة قبل الربط. التفاصيل الكاملة في دليل الإعداد.",
    checklistOfficialOnly:
      "يستخدم CliniBot منصة واتساب للأعمال الرسمية (Cloud API) من Meta فقط، ولا يستخدم واتساب ويب ولا أي حساب شخصي.",
    checkPortfolio: "حساب أعمال لدى Meta موثّق",
    checkPortfolioText:
      "أنشئ حساب أعمال للعيادة في {business} وأكمل توثيق النشاط التجاري (السجل التجاري). الحسابات غير الموثّقة محدودة بعدد قليل من المحادثات.",
    checkNumber: "رقم هاتف مخصص لمنصة واتساب",
    checkNumberText:
      "يستقبل رسالة نصية أو مكالمة للتحقق، ولا يكون مفعّلاً في تطبيق واتساب أو واتساب للأعمال في الوقت نفسه (انقله أو احذفه من التطبيق أولاً).",
    checkDisplayName: "اسم عرض معتمد من Meta",
    checkDisplayNameText: "يجب أن يطابق اسم العيادة وعلامتها التجارية.",
    checkApp: "تطبيق لدى Meta فيه منتج WhatsApp",
    checkAppText:
      "من {developers} أنشئ تطبيقاً من نوع Business، وأضف إليه منتج WhatsApp، واربطه بحساب أعمال العيادة.",
    checkIds: "معرّف رقم الهاتف ومعرّف حساب واتساب للأعمال",
    checkIdsText: "تجدهما في صفحة WhatsApp ← API Setup داخل التطبيق.",
    checkToken: "رمز وصول دائم",
    checkTokenText:
      "في {business}: إعدادات الأعمال ← المستخدمون ← مستخدمو النظام. أضف مستخدم نظام بصلاحية مسؤول، وامنحه التطبيق وحساب واتساب، وأنشئ رمزاً بصلاحيتي whatsapp_business_messaging و whatsapp_business_management.",
    checkSecret: "المفتاح السري للتطبيق",
    checkSecretText: "من إعدادات التطبيق ← Basic ← App secret.",
    checklistCosts:
      "تفرض Meta رسوماً على المحادثات حسب أسعارها في السعودية، وتحدد عدد العملاء الجدد يومياً للأرقام الجديدة. لا يضيف CliniBot هذه الرسوم ولا يخفيها. التفاصيل في {doc}.",

    // Actions
    actionsTitle: "إدارة الربط",
    actionsDescription: "اختبر البيانات المحفوظة لدى Meta، أو أنشئ رمز تحقق جديداً، أو افصل الرقم.",
    testConnection: "اختبار الربط",
    regenerateToken: "إنشاء رمز تحقق جديد",
    replaceCredentials: "استبدال البيانات",
    disconnect: "فصل واتساب",
    testOkTitle: "قبلت Meta البيانات المحفوظة",
    testOkNote: "يؤكد هذا صلاحية رمز الوصول فقط؛ وصول الرسائل يتطلب أيضاً اكتمال تحقق الـ Webhook.",
    rotateTitle: "إنشاء رمز تحقق جديد؟",
    rotateText:
      "سيتوقف الرمز الحالي فوراً، وتعود الحالة إلى «بانتظار تحقق Meta» حتى تُدخل الرمز الجديد في تطبيق Meta وتضغط Verify and save.",
    rotateConfirm: "إنشاء رمز جديد",
    disconnectTitle: "فصل رقم واتساب؟",
    disconnectText: "ستُحذف بيانات الربط المحفوظة نهائياً. للربط من جديد يلزم إدخالها مرة أخرى.",
    disconnectConfirm: "فصل واتساب",
    disconnected: "فُصل رقم واتساب عن العيادة.",
    disconnectEffect1: "يتوقف المساعد عن الرد على رسائل واتساب.",
    disconnectEffect2: "لا يستطيع الفريق إرسال ردود أو تأكيدات مواعيد عبر واتساب.",
    disconnectEffect3: "تبقى المحادثات السابقة محفوظة في صفحة المحادثات.",

    // Confirmation template
    templateTitle: "قالب تأكيد المواعيد",
    templateDescription:
      "يُستخدم لإبلاغ المريض بتأكيد موعده عبر واتساب إذا مرّت أكثر من 24 ساعة على آخر رسالة منه.",
    windowTitle: "نافذة خدمة العملاء (24 ساعة)",
    windowText:
      "يسمح واتساب بالرد برسائل عادية خلال 24 ساعة من آخر رسالة أرسلها المريض. بعدها لا يمكن الإرسال إلا بقالب وافقت عليه Meta مسبقاً، ولذلك يحتاج تأكيد المواعيد المتأخر إلى هذا القالب.",
    templateRules:
      "أنشئ في WhatsApp Manager قالباً من فئة Utility، ونصه يحتوي على ثلاثة متغيرات بالضبط وبهذا الترتيب:",
    templateVar1: "اسم المريض",
    templateVar2: "التاريخ",
    templateVar3: "الوقت",
    templateExampleLabel: "مثال بالعربية",
    templateExample:
      "مرحباً {{1}}، تم تأكيد موعدك لدى العيادة بتاريخ {{2}} الساعة {{3}}. للتعديل يرجى التواصل مع الاستقبال.",
    templateNeedsConnection: "اربط رقم واتساب أولاً، ثم أدخل اسم القالب ولغته هنا.",
    templateName: "اسم القالب",
    templateNameHint: "كما يظهر في WhatsApp Manager بعد موافقة Meta، مثل appointment_confirmation.",
    templateLanguage: "لغة القالب",
    templateEmptyNote:
      "بدون قالب لا يمكن إرسال تأكيد عبر واتساب بعد مرور 24 ساعة على آخر رسالة من المريض؛ سيطلب منك النظام الاتصال به.",
    templateSaved: "حُفظ قالب التأكيد.",
    langAr: "العربية",
    langEn: "الإنجليزية",
    langEnUs: "الإنجليزية (الولايات المتحدة)",
    langEnGb: "الإنجليزية (المملكة المتحدة)",
  },
  en: {
    title: "WhatsApp",
    description:
      "Connect the clinic's WhatsApp Business number through Meta's official WhatsApp platform, so the assistant can reply to patients and your team receives their messages.",
    refreshStatus: "Refresh status",
    notYet: "Not yet",
    none: "Not available",

    // Status
    statusTitle: "Connection status",
    statusDisconnected: "Disconnected",
    statusDisconnectedText:
      "No WhatsApp number is connected. WhatsApp messages don't reach CliniBot and the assistant doesn't answer them.",
    statusCredentialsVerified: "Credentials verified — waiting for Meta webhook verification",
    statusCredentialsVerifiedText:
      "Meta accepted the credentials, but hasn't verified the webhook URL yet. Finish the steps in your Meta app; this status updates by itself.",
    statusConnected: "Connected",
    statusConnectedText:
      "Meta accepted the credentials and completed the webhook verification. WhatsApp messages reach CliniBot.",
    statusError: "Error",
    statusErrorText:
      "The last request to Meta with the connection details failed, and CliniBot doesn't send WhatsApp messages in this state. Review the error, then test the connection or enter new details.",
    lastErrorTitle: "Last error from Meta",
    phoneNumber: "Phone number",
    verifiedName: "Verified name",
    credentialsVerifiedAt: "Credentials verified",
    webhookVerifiedAt: "Meta webhook verification",
    lastInboundAt: "Last incoming message",
    callbackUrl: "Callback URL",
    copyCallbackUrl: "Copy the callback URL",
    callbackUrlHint: "This URL isn't a secret: every request to it must carry Meta's valid signature.",
    receptionistNote: "The clinic's owner or an admin manages the WhatsApp connection and its settings.",
    qualityRating: "Meta quality rating",
    qualityHigh: "High",
    qualityMedium: "Medium",
    qualityLow: "Low",
    qualityUnknown: "Not available",

    // Credentials
    credentialsTitle: "Connection details",
    credentialsDescription:
      "Enter the details from your Meta app. CliniBot checks them with Meta first and stores nothing if Meta rejects them.",
    replaceTitle: "Replace connection details",
    replaceDescription:
      "The new details replace the stored ones once Meta accepts them. You'll then need to complete the webhook verification again.",
    phoneNumberId: "Phone number ID",
    phoneNumberIdHint: "Digits only, from WhatsApp → API Setup. It isn't the phone number itself.",
    wabaId: "WhatsApp Business Account ID (WABA ID)",
    wabaIdHint: "Digits only, from the same page.",
    accessToken: "Permanent access token",
    accessTokenHint:
      "A system user token with whatsapp_business_messaging and whatsapp_business_management. Don't use the temporary 24-hour token.",
    appSecret: "App secret",
    appSecretHint:
      "From the app's settings → Basic. CliniBot uses it to check that every incoming message really comes from Meta.",
    secretsNote:
      "The access token and app secret are sent to the server once and stored encrypted. They're never shown again to anyone; to change them, enter them again.",
    verifying: "Checking with Meta…",
    saveAndVerify: "Save and verify",
    encryptionMissingTitle: "WhatsApp connection isn't available on this server yet",
    encryptionMissingShort:
      "The platform operator hasn't set the credentials encryption key, so WhatsApp details can't be saved yet. Let the platform operator know.",
    encryptionMissingText:
      "The platform operator hasn't set the {secret} secret, so WhatsApp details can't be stored safely. The operator must add it under Supabase → Edge Functions → Secrets as described in {doc}, then try again. Nothing was saved.",

    // Validation
    errRequired: "This field is required.",
    errDigits: "Digits only, {min} to {max} digits.",
    errSecretChars: "Contains spaces or characters that aren't allowed. Copy it exactly from Meta.",
    errLength: "Wrong length ({min} to {max} characters). Make sure you copied all of it.",
    errServerField: "The server rejected this value. Check it and enter it again.",
    errTemplateName:
      "Template names use lowercase English letters, digits and underscores (_) only, exactly as shown in Meta.",
    errTemplateLanguage: "Choose the template language.",

    // Connect errors
    metaRejectedTitle: "Meta rejected the request",
    metaRejectedSave:
      "Meta didn't accept these details, and nothing was saved. Check them and enter the access token and app secret again.",
    metaRejectedTest: "The connection test with the stored details failed, and the status is now “Error”.",
    metaRejectedOther: "Meta didn't complete the request.",
    metaCode: "Meta error code",
    metaMessage: "Meta's message",
    metaCode190:
      "Code 190 means the access token has expired or lacks permissions. Create a permanent system user token with the required permissions.",
    phoneInUseTitle: "Number already in use",
    phoneInUseText:
      "One number can't be connected to more than one clinic. If the number belongs to your clinic, contact support.",

    // One-time reveal
    revealSavedTitle: "Meta accepted the details. One last step in Meta",
    revealRotatedTitle: "A new verify token was created",
    revealSavedText:
      "Copy the callback URL and verify token now and enter them in your Meta app. The status becomes “Connected” once Meta verifies them.",
    revealRotatedText:
      "The previous token no longer works. Enter the new token in your Meta app and press Verify and save to complete the verification again.",
    revealWarningTitle: "The verify token is shown only this once",
    revealWarning:
      "CliniBot doesn't keep the verify token in readable form, and it won't be shown again after you close this panel or leave the page. If you lose it, create a new one.",
    verifyToken: "Verify token",
    copyVerifyToken: "Copy the verify token",
    appNotSubscribedTitle: "The app isn't subscribed to the WhatsApp Business Account",
    appNotSubscribedText:
      "CliniBot tried to subscribe your app to the WhatsApp Business Account and couldn't. Without it, messages won't arrive. Subscribe it in WhatsApp Manager, or save the details again later.",
    webhookStepsTitle: "Steps in your Meta app (developers.facebook.com)",
    revealDone: "I've copied them — close",
    webhookStep1: "Open your app in Meta, then {path}.",
    webhookStep2: "Paste the callback URL into {callback} and the verify token into {verify}.",
    webhookStep3: "Press {button}. Meta contacts CliniBot to check the token.",
    webhookStep4: "Under {fields}, subscribe to the {field} field (it also delivers delivery and read receipts).",
    webhookStep5:
      "Send a WhatsApp message to the clinic's number from another phone and check that it appears under Conversations.",

    // Waiting for Meta
    waitingTitle: "Waiting for Meta to verify the webhook",
    waitingDescription:
      "Meta accepted the credentials. The connection won't show as “Connected” until you finish these steps in your Meta app. This page updates by itself.",
    waitingLostToken:
      "Don't have the verify token anymore? It can't be shown again, but you can create a new one with “Create a new verify token” below.",

    // Setup checklist
    checklistTitle: "What your clinic needs from Meta",
    checklistDescription: "One-time setup before connecting. The full guide has every detail.",
    checklistOfficialOnly:
      "CliniBot uses only Meta's official WhatsApp Business Platform (Cloud API). It never uses WhatsApp Web or a personal account.",
    checkPortfolio: "A verified Meta business portfolio",
    checkPortfolioText:
      "Create a business portfolio for the clinic at {business} and complete business verification (commercial registration). Unverified businesses are limited to a few conversations.",
    checkNumber: "A phone number for the WhatsApp platform",
    checkNumberText:
      "It must be able to receive an SMS or call for verification and must not be active on the WhatsApp or WhatsApp Business app at the same time (migrate or delete it there first).",
    checkDisplayName: "A display name approved by Meta",
    checkDisplayNameText: "It must match the clinic's name and brand.",
    checkApp: "A Meta app with the WhatsApp product",
    checkAppText:
      "At {developers}, create an app of type Business, add the WhatsApp product, and link it to the clinic's business portfolio.",
    checkIds: "Phone number ID and WhatsApp Business Account ID",
    checkIdsText: "Both are on the app's WhatsApp → API Setup page.",
    checkToken: "A permanent access token",
    checkTokenText:
      "In {business}: Business settings → Users → System users. Add a system user with Admin access, assign it the app and the WhatsApp account, and generate a token with whatsapp_business_messaging and whatsapp_business_management.",
    checkSecret: "The app secret",
    checkSecretText: "From the app's settings → Basic → App secret.",
    checklistCosts:
      "Meta charges for conversations at its current Saudi Arabia rates and limits how many new customers a new number can message per day. CliniBot doesn't add or hide these charges. Details in {doc}.",

    // Actions
    actionsTitle: "Manage the connection",
    actionsDescription:
      "Test the stored details with Meta, create a new verify token, or disconnect the number.",
    testConnection: "Test connection",
    regenerateToken: "Create a new verify token",
    replaceCredentials: "Replace details",
    disconnect: "Disconnect WhatsApp",
    testOkTitle: "Meta accepted the stored details",
    testOkNote:
      "This confirms the access token works. Receiving messages also needs the webhook verification to be complete.",
    rotateTitle: "Create a new verify token?",
    rotateText:
      "The current token stops working immediately, and the status goes back to “waiting for Meta verification” until you enter the new token in your Meta app and press Verify and save.",
    rotateConfirm: "Create new token",
    disconnectTitle: "Disconnect the WhatsApp number?",
    disconnectText:
      "The stored connection details are permanently deleted. To connect again you'll need to enter them again.",
    disconnectConfirm: "Disconnect WhatsApp",
    disconnected: "The WhatsApp number was disconnected from the clinic.",
    disconnectEffect1: "The assistant stops replying to WhatsApp messages.",
    disconnectEffect2: "Your team can't send replies or appointment confirmations on WhatsApp.",
    disconnectEffect3: "Past conversations stay under Conversations.",

    // Confirmation template
    templateTitle: "Appointment confirmation template",
    templateDescription:
      "Used to tell a patient their appointment is confirmed on WhatsApp when their last message was more than 24 hours ago.",
    windowTitle: "The 24-hour customer service window",
    windowText:
      "WhatsApp allows normal replies within 24 hours of the patient's last message. After that, only a template Meta has approved in advance can be sent, which is why late appointment confirmations need this template.",
    templateRules:
      "In WhatsApp Manager, create a Utility template whose body has exactly three variables, in this order:",
    templateVar1: "patient's name",
    templateVar2: "date",
    templateVar3: "time",
    templateExampleLabel: "Example in Arabic",
    templateExample:
      "مرحباً {{1}}، تم تأكيد موعدك لدى العيادة بتاريخ {{2}} الساعة {{3}}. للتعديل يرجى التواصل مع الاستقبال.",
    templateNeedsConnection: "Connect a WhatsApp number first, then enter the template name and language here.",
    templateName: "Template name",
    templateNameHint: "Exactly as shown in WhatsApp Manager after Meta approves it, e.g. appointment_confirmation.",
    templateLanguage: "Template language",
    templateEmptyNote:
      "Without a template, a WhatsApp confirmation can't be sent once 24 hours have passed since the patient's last message; you'll be asked to call them instead.",
    templateSaved: "Confirmation template saved.",
    langAr: "Arabic",
    langEn: "English",
    langEnUs: "English (US)",
    langEnGb: "English (UK)",
  },
} satisfies Namespace;
