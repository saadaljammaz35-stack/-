import type { Namespace } from "../types";

export default {
  ar: {
    title: "الاشتراك",
    description: "باقتك الحالية وفترة التجربة والاستخدام الشهري.",
    noAccessTitle: "الاشتراك متاح للمالك والمديرين",
    noAccessText:
      "يطّلع على تفاصيل الباقة والاستخدام مالكُ العيادة ومديروها. إذا كان لديك سؤال عن الاشتراك فتواصل مع أحدهم.",
    // Payments notice
    paymentsTitle: "الدفع الإلكتروني غير متاح بعد",
    paymentsText:
      "لا يمكن الدفع أو تغيير الباقة من داخل التطبيق حالياً. للترقية أو للاستمرار بعد انتهاء التجربة، تواصل مع فريق CliniBot وسنرتّب ذلك معك.",
    paymentsNoCard: "لا نطلب بيانات بطاقتك داخل التطبيق أبداً.",
    contactTeam: "تواصل مع فريق CliniBot",
    emailTeam: "راسلنا: {email}",
    // Current plan
    currentTitle: "باقتك الحالية",
    planLabel: "الباقة",
    statusLabel: "الحالة",
    state_none: "لا يوجد اشتراك",
    state_trial: "تجربة مجانية",
    state_trial_ended: "انتهت التجربة",
    state_active: "نشط",
    state_past_due: "متأخر السداد",
    state_cancelled: "ملغى",
    state_expired: "منتهٍ",
    noSubscriptionText:
      "لا يوجد اشتراك مسجّل لهذه العيادة، لذلك لا يرد المساعد الذكي آلياً. تواصل مع فريق CliniBot لتفعيل باقة.",
    trialEnds: "تنتهي التجربة في {date}",
    daysLeft: "الأيام المتبقية: {count}",
    trialEndedText:
      "انتهت فترة التجربة في {date}، ولن يرد المساعد الذكي آلياً حتى يُفعَّل اشتراك. تصل رسائل المرضى إلى فريق الاستقبال كالمعتاد.",
    periodEnds: "تنتهي الفترة الحالية في {date}",
    inactiveText:
      "اشتراك العيادة غير نشط حالياً، لذلك لا يرد المساعد الذكي آلياً. تواصل مع فريق CliniBot لتفعيله.",
    pastDueText: "يوجد مبلغ مستحق على الاشتراك. تواصل مع فريق CliniBot لتسويته.",
    // Usage this month
    aiUsageLabel: "ردود الذكاء الاصطناعي هذا الشهر",
    aiUsageValue: "{used} من {limit}",
    aiUsageHint:
      "تُحتسب كل رسالة من مريض أو من صفحة التجربة عالجتها خدمة الذكاء الاصطناعي، مرة واحدة لكل رسالة، بما فيها الردود التي حُجبت أو رُفضت أو تعذّر إرسالها وحُوِّلت إلى فريق الاستقبال. ويبدأ العد من جديد أول كل شهر بتوقيت الرياض.",
    trialCapNote: "خلال فترة التجربة يُحدَّد الحد الشهري لردود الذكاء الاصطناعي بـ {cap}.",
    aiUsageHigh: "اقتربت من الحد الشهري لردود الذكاء الاصطناعي.",
    aiUsageFull:
      "استُنفد الحد الشهري، فلن يرد المساعد آلياً حتى بداية الشهر القادم. تبقى رسائل المرضى تصل إلى فريق الاستقبال.",
    seatsLabel: "مقاعد الفريق",
    seatsValue: "{used} من {limit}",
    seatsUnknown: "غير محدد",
    manageTeam: "إدارة الفريق",
    usageMeterLabel: "{label}: {used} من {limit}",
    // Plans
    plansTitle: "الباقات",
    plansDescription: "الأسعار شهرية بالريال السعودي ولا تشمل ضريبة القيمة المضافة.",
    perMonth: "شهرياً",
    exclVat: "غير شامل ضريبة القيمة المضافة",
    planAiReplies: "ردود الذكاء الاصطناعي شهرياً",
    planSeats: "أعضاء الفريق",
    currentBadge: "باقتك الحالية",
    plansEmpty: "لا توجد باقات لعرضها حالياً.",
    // Usage history
    historyTitle: "سجل الاستخدام",
    historyDescription: "ردود الذكاء الاصطناعي واستهلاك الرموز (tokens) في كل شهر، لآخر 12 شهراً.",
    historyCaption: "استخدام الذكاء الاصطناعي حسب الشهر",
    colMonth: "الشهر",
    colReplies: "ردود المرضى",
    colTestReplies: "ردود التجربة",
    colInputTokens: "رموز الإدخال",
    colOutputTokens: "رموز الإخراج",
    historyEmptyTitle: "لا يوجد استخدام بعد",
    historyEmptyText: "سيظهر هنا عدد ردود المساعد الذكي في كل شهر بعد أول رد أو أول تجربة.",
  },
  en: {
    title: "Billing",
    description: "Your current plan, trial period and monthly usage.",
    noAccessTitle: "Billing is for owners and admins",
    noAccessText:
      "Plan and usage details are visible to the clinic's owners and admins. If you have a question about the subscription, ask one of them.",
    // Payments notice
    paymentsTitle: "Online payment isn't available yet",
    paymentsText:
      "You can't pay or change plans inside the app at the moment. To upgrade, or to continue after your trial, contact the CliniBot team and we'll arrange it with you.",
    paymentsNoCard: "We never ask for your card details inside the app.",
    contactTeam: "Contact the CliniBot team",
    emailTeam: "Email us: {email}",
    // Current plan
    currentTitle: "Your current plan",
    planLabel: "Plan",
    statusLabel: "Status",
    state_none: "No subscription",
    state_trial: "Free trial",
    state_trial_ended: "Trial ended",
    state_active: "Active",
    state_past_due: "Payment overdue",
    state_cancelled: "Cancelled",
    state_expired: "Expired",
    noSubscriptionText:
      "This clinic has no subscription on record, so the AI assistant doesn't reply. Contact the CliniBot team to activate a plan.",
    trialEnds: "Trial ends on {date}",
    daysLeft: "Days left: {count}",
    trialEndedText:
      "Your trial ended on {date}, so the AI assistant won't reply until a subscription is active. Patient messages still reach reception as usual.",
    periodEnds: "Current period ends on {date}",
    inactiveText:
      "The clinic's subscription isn't active, so the AI assistant doesn't reply. Contact the CliniBot team to activate it.",
    pastDueText:
      "A payment on the subscription is overdue. Contact the CliniBot team to settle it.",
    // Usage this month
    aiUsageLabel: "AI replies this month",
    aiUsageValue: "{used} of {limit}",
    aiUsageHint:
      "Counts every patient message and test-page message the AI service answered, once per message, including replies that were withheld, refused or failed and passed to reception instead. The count restarts on the 1st of each month (Riyadh time).",
    trialCapNote: "During the trial, AI replies are capped at {cap} a month.",
    aiUsageHigh: "You're close to this month's AI reply limit.",
    aiUsageFull:
      "This month's limit is used up, so the assistant won't reply automatically until next month. Patient messages still reach reception.",
    seatsLabel: "Team seats",
    seatsValue: "{used} of {limit}",
    seatsUnknown: "Not set",
    manageTeam: "Manage team",
    usageMeterLabel: "{label}: {used} of {limit}",
    // Plans
    plansTitle: "Plans",
    plansDescription: "Monthly prices in Saudi riyals, excluding VAT.",
    perMonth: "per month",
    exclVat: "excluding VAT",
    planAiReplies: "AI replies per month",
    planSeats: "Team members",
    currentBadge: "Your plan",
    plansEmpty: "No plans to show right now.",
    // Usage history
    historyTitle: "Usage history",
    historyDescription: "AI replies and tokens used each month, for the last 12 months.",
    historyCaption: "AI usage by month",
    colMonth: "Month",
    colReplies: "Patient replies",
    colTestReplies: "Test replies",
    colInputTokens: "Input tokens",
    colOutputTokens: "Output tokens",
    historyEmptyTitle: "No usage yet",
    historyEmptyText:
      "Each month's AI assistant replies will appear here after the first reply or test.",
  },
} satisfies Namespace;
