import type { Namespace } from "../types";

export default {
  ar: {
    title: "محادثة العيادة",
    description: "تحدّث مع المساعد الذكي للعيادة لمعرفة الخدمات والأسعار وطلب موعد.",
    poweredBy: "يعمل بواسطة {brand}",

    // Header
    callReception: "الاستقبال",
    callReceptionNumber: "اتصل بالاستقبال على الرقم {phone}",
    chatOptions: "خيارات المحادثة",
    emergency: "في حالات الطوارئ اتصل فوراً بـ {number}",

    // Loading / unavailable
    loading: "جارٍ تحميل المحادثة…",
    notFoundTitle: "المحادثة غير متاحة",
    notFoundText:
      "لم نجد هذه العيادة، أو أنها لم تفعّل المحادثة عبر الموقع. تأكد من الرابط، أو تواصل مع العيادة مباشرة.",
    notFoundHome: "تعرّف على CliniBot",
    loadErrorTitle: "تعذّر تحميل المحادثة",

    // Consent
    consentTitle: "قبل أن نبدأ",
    consentIntro: "يُرجى قراءة إشعار الخصوصية الخاص بـ {clinic}:",
    noticeHeading: "إشعار الخصوصية",
    pointsTitle: "باختصار",
    pointStored: "تحتفظ العيادة برسائلك في هذه المحادثة لتتمكن من الرد عليك ومتابعة طلبك.",
    pointDelete: "يمكنك حذف محادثتك في أي وقت من قائمة «خيارات المحادثة».",
    pointNotDoctor: "المساعد الآلي ليس طبيباً، ولا يقدّم استشارات أو تشخيصات طبية.",
    pointEmergency: "في الحالات الطارئة لا تنتظر الرد، بل اتصل فوراً بالرقم {number}.",
    consentCheckbox:
      "قرأت إشعار الخصوصية، وأوافق على أن تحتفظ العيادة برسائلي في هذه المحادثة للرد عليّ.",
    consentRequired: "يجب الموافقة على إشعار الخصوصية لبدء المحادثة.",
    privacyMore: "لمزيد من التفاصيل اطّلع على {link}.",
    privacyLink: "سياسة الخصوصية في CliniBot",
    startChat: "ابدأ المحادثة",
    noticeDeleted: "حُذفت محادثتك وجميع رسائلها. يمكنك بدء محادثة جديدة متى شئت.",
    noticeExpired: "انتهت محادثتك السابقة أو حُذفت، فلا يمكن متابعتها. يمكنك بدء محادثة جديدة.",
    noticeLeft: "ما زالت محادثتك السابقة محفوظة لدى العيادة. يمكنك الآن بدء محادثة جديدة.",
    storageUnavailable:
      "لا يسمح متصفحك بحفظ المحادثة على هذا الجهاز، لذلك ستنتهي المحادثة إذا حدّثت الصفحة أو أغلقتها.",

    // Conversation
    messagesLabel: "رسائل المحادثة",
    you: "أنت",
    clinicTeam: "فريق العيادة",
    systemNotice: "إشعار",
    welcomeLabel: "رسالة ترحيب",
    sending: "جارٍ الإرسال…",
    typingAssistant: "{name} يكتب ردّه…",
    typingSending: "جارٍ إرسال رسالتك…",
    newMessage: "رسالة جديدة من {sender}: {text}",
    emptyHistory: "لا توجد رسائل في هذه المحادثة بعد. اكتب سؤالك للبدء.",
    loadingHistory: "جارٍ تحميل محادثتك…",
    historyErrorTitle: "تعذّر تحميل محادثتك",
    awaitingHuman: "سيتابع معك أحد موظفي العيادة",
    awaitingHumanDetail:
      "توقّف المساعد الآلي في هذه المحادثة، وتصل رسائلك مباشرة إلى فريق العيادة.",
    assistantUnavailable: "المساعد الآلي غير متاح حالياً",
    assistantUnavailableDetail: "ما زالت رسائلك تصل إلى موظفي الاستقبال في العيادة.",
    callForFaster: "للتواصل الأسرع اتصل بالاستقبال على {phone}.",
    closedTitle: "أُغلقت هذه المحادثة",
    closedDetail: "إذا أرسلت رسالة جديدة فستُفتح المحادثة من جديد وتصل إلى فريق العيادة.",
    connectionLost: "تعذّر جلب الرسائل الجديدة، وسنعيد المحاولة تلقائياً.",
    retryNow: "أعد المحاولة الآن",
    sendUnconfirmed: "ما زلنا ننتظر الرد، وقد تكون رسالتك وصلت بالفعل. نتحقق من ذلك الآن.",
    sendFailed: "لم تُرسَل رسالتك",
    sendFailedKept: "أعدنا نص رسالتك إلى مربع الكتابة.",
    sendUncertain: "لم نتمكن من التأكد من إرسال رسالتك",
    sendUncertainHint:
      "تحقّق من المحادثة أعلاه قبل الإرسال مجدداً. أعدنا نص رسالتك إلى مربع الكتابة.",
    resend: "إعادة الإرسال",

    // Composer
    composerLabel: "اكتب رسالتك",
    composerPlaceholder: "اكتب رسالتك هنا…",
    send: "إرسال",
    charCount: "عدد الأحرف: {count} من {max}",
    tooLong: "الرسالة أطول من {max} حرف، يُرجى اختصارها.",
    keyboardHint: "اضغط Enter للإرسال، وShift+Enter لسطر جديد.",
    cooldown: "يمكنك محاولة الإرسال مجدداً الساعة {time}.",

    // Menu
    newChat: "بدء محادثة جديدة",
    newChatTitle: "بدء محادثة جديدة؟",
    newChatText:
      "ستبقى محادثتك الحالية محفوظة لدى العيادة، لكن لن تتمكن من فتحها أو حذفها من هذا الجهاز بعد ذلك. إذا أردت حذفها فاختر «حذف محادثتي» أولاً.",
    newChatConfirm: "بدء محادثة جديدة",
    deleteChat: "حذف محادثتي",
    deleteTitle: "حذف محادثتك؟",
    deleteText:
      "ستُحذف هذه المحادثة وجميع رسائلها من سجلات العيادة نهائياً، ولا يمكن التراجع عن ذلك. إذا كنت قد طلبت موعداً فقد تحتفظ العيادة بطلب الموعد لمتابعته.",
    deleteConfirm: "حذف المحادثة",
  },
  en: {
    title: "Clinic chat",
    description:
      "Chat with the clinic's assistant about services and prices, or request an appointment.",
    poweredBy: "Powered by {brand}",

    // Header
    callReception: "Reception",
    callReceptionNumber: "Call reception at {phone}",
    chatOptions: "Chat options",
    emergency: "In an emergency, call {number} immediately",

    // Loading / unavailable
    loading: "Loading the chat…",
    notFoundTitle: "This chat isn't available",
    notFoundText:
      "We couldn't find this clinic, or its web chat isn't turned on. Check the link, or contact the clinic directly.",
    notFoundHome: "About CliniBot",
    loadErrorTitle: "We couldn't load the chat",

    // Consent
    consentTitle: "Before we start",
    consentIntro: "Please read {clinic}'s privacy notice:",
    noticeHeading: "Privacy notice",
    pointsTitle: "In short",
    pointStored:
      "The clinic keeps the messages in this chat so it can answer you and follow up on your request.",
    pointDelete: "You can delete your conversation at any time from the “Chat options” menu.",
    pointNotDoctor:
      "The automated assistant is not a doctor and cannot give medical advice or diagnoses.",
    pointEmergency: "In an emergency, don't wait for a reply: call {number} right away.",
    consentCheckbox:
      "I have read the privacy notice and agree that the clinic keeps my messages in this chat to answer me.",
    consentRequired: "Please accept the privacy notice to start the chat.",
    privacyMore: "For more detail, read the {link}.",
    privacyLink: "CliniBot privacy policy",
    startChat: "Start the chat",
    noticeDeleted:
      "Your conversation and all its messages were deleted. You can start a new chat whenever you like.",
    noticeExpired:
      "Your previous conversation has ended or was deleted, so it can't be continued. You can start a new chat.",
    noticeLeft:
      "Your previous conversation is still kept by the clinic. You can start a new chat now.",
    storageUnavailable:
      "Your browser doesn't allow saving the chat on this device, so the chat will end if you refresh or close the page.",

    // Conversation
    messagesLabel: "Conversation messages",
    you: "You",
    clinicTeam: "Clinic team",
    systemNotice: "Notice",
    welcomeLabel: "Welcome message",
    sending: "Sending…",
    typingAssistant: "{name} is writing a reply…",
    typingSending: "Sending your message…",
    newMessage: "New message from {sender}: {text}",
    emptyHistory: "There are no messages in this conversation yet. Type your question to begin.",
    loadingHistory: "Loading your conversation…",
    historyErrorTitle: "We couldn't load your conversation",
    awaitingHuman: "A member of the clinic team will follow up with you",
    awaitingHumanDetail:
      "The automated assistant has stopped in this conversation; your messages go straight to the clinic team.",
    assistantUnavailable: "The automated assistant isn't available right now",
    assistantUnavailableDetail: "Your messages still reach the clinic's reception team.",
    callForFaster: "For a faster answer, call reception at {phone}.",
    closedTitle: "This conversation was closed",
    closedDetail:
      "If you send a new message, the conversation reopens and reaches the clinic team.",
    connectionLost: "We couldn't fetch new messages. We'll keep trying automatically.",
    retryNow: "Try now",
    sendUnconfirmed:
      "Still waiting for a reply. Your message may already have been delivered; we're checking.",
    sendFailed: "Your message wasn't sent",
    sendFailedKept: "We've put your text back in the message box.",
    sendUncertain: "We couldn't confirm your message was sent",
    sendUncertainHint:
      "Check the conversation above before sending again. We've put your text back in the message box.",
    resend: "Send again",

    // Composer
    composerLabel: "Type your message",
    composerPlaceholder: "Type your message…",
    send: "Send",
    charCount: "Characters: {count} of {max}",
    tooLong: "Your message is longer than {max} characters. Please shorten it.",
    keyboardHint: "Press Enter to send, Shift+Enter for a new line.",
    cooldown: "You can try sending again at {time}.",

    // Menu
    newChat: "Start a new chat",
    newChatTitle: "Start a new chat?",
    newChatText:
      "Your current conversation stays with the clinic, but you won't be able to open or delete it from this device afterwards. To delete it, choose “Delete my conversation” first.",
    newChatConfirm: "Start new chat",
    deleteChat: "Delete my conversation",
    deleteTitle: "Delete your conversation?",
    deleteText:
      "This conversation and all its messages will be permanently deleted from the clinic's records. This can't be undone. If you requested an appointment, the clinic may keep that request to follow up.",
    deleteConfirm: "Delete conversation",
  },
} satisfies Namespace;
