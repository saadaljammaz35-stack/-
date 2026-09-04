/**
 * Localisation.
 *
 * Arabic is the source language, not a translation of English — the Arabic
 * strings were written first and the English follows them. That ordering shows
 * up in the copy: it reads naturally in Arabic rather than as a literal
 * rendering of an English sentence.
 */

import { I18nManager } from 'react-native';

export type Locale = 'ar' | 'en';

export const strings = {
  ar: {
    appName: 'نَبض',
    tagline: 'منصة مالية',

    greetingMorning: 'صباح الخير',
    greetingAfternoon: 'مساء الخير',
    greetingEvening: 'مساء الخير',

    totalBalance: 'الرصيد الإجمالي',
    availableBalance: 'الرصيد المتاح',
    hideBalance: 'إخفاء الرصيد',
    showBalance: 'إظهار الرصيد',
    balanceHidden: '••••••',
    heldAmount: 'مبلغ محجوز',

    sendToPhone: 'أرسل لرقم جوال',
    recipientPhone: 'رقم جوال المستقبل',
    confirmRecipient: 'تأكيد المستلم',
    sendingTo: 'ترسل إلى',
    instantFree: 'فوري ومجاني',
    amountToSend: 'المبلغ',
    confirmAndSend: 'تأكيد وإرسال',
    recipientNotFound: 'لا يوجد مستخدم بهذا الرقم في نَبض',
    walletTier: 'مستوى المحفظة',
    remainingToday: 'المتبقي اليوم',
    upgradeToRaise: 'ارفع مستوى التحقق لزيادة الحد',
    verifyIdentity: 'توثيق الهوية',
    // top-up
    topUpTitle: 'شحن المحفظة',
    topUpSource: 'طريقة الشحن',
    sourceCard: 'بطاقة مدى أو ائتمانية',
    sourceBankTransfer: 'تحويل بنكي',
    sourceApplePay: 'Apple Pay',
    topUpPending: 'بانتظار تأكيد المزوّد',
    topUpPendingHint: 'ما راح يضاف الرصيد إلا بعد تأكيد استلام المبلغ',
    topUpDone: 'تم الشحن',

    // qr
    myQr: 'رمزي',
    scanQr: 'مسح رمز',
    myQrHint: 'خلّ غيرك يمسح الرمز عشان يحوّل لك',
    requestAmount: 'تحديد مبلغ',
    scanning: 'وجّه الكاميرا على الرمز',
    qrInvalid: 'رمز غير صالح أو تالف',
    qrNotNabd: 'هذا الرمز ليس من نَبض',
    qrSelfPay: 'ما تقدر تدفع لنفسك',
    qrAlreadyPaid: 'هذا الرمز مدفوع مسبقًا',
    payMerchant: 'الدفع لـ',

    // cards
    cardsTitle: 'بطاقاتي',
    cardVirtual: 'بطاقة رقمية',
    cardPhysical: 'بطاقة فعلية',
    freezeCard: 'تجميد',
    unfreezeCard: 'إلغاء التجميد',
    cardFrozen: 'مجمّدة',
    cardActive: 'نشطة',
    cardBlocked: 'محظورة',
    newCard: 'بطاقة جديدة',
    cardSpendsFromWallet: 'تصرف من رصيد محفظتك مباشرة',
    cardLimits: 'الحدود',

    // kyc
    kycTitle: 'توثيق الهوية',
    kycWhy: 'التوثيق يرفع حدود محفظتك ويفعّل التحويلات',
    kycIdFront: 'وجه الهوية',
    kycIdBack: 'ظهر الهوية',
    kycSelfie: 'صورة شخصية',
    kycProofAddress: 'إثبات عنوان',
    kycUpload: 'رفع',
    kycUploaded: 'تم الرفع',
    kycSubmit: 'إرسال للمراجعة',
    kycUnderReview: 'قيد المراجعة',
    kycUnderReviewHint: 'عادةً تأخذ أقل من 24 ساعة',
    kycVerified: 'تم التوثيق',
    kycRejected: 'مرفوض',
    kycMissing: 'ناقص',

    // transaction detail
    transactionDetail: 'تفاصيل العملية',
    reference: 'الرقم المرجعي',
    dateTime: 'التاريخ والوقت',
    from: 'من',
    to: 'إلى',
    copyReference: 'نسخ الرقم المرجعي',
    reportProblem: 'الإبلاغ عن مشكلة',

    actionTransfer: 'تحويل',
    actionPay: 'دفع',
    actionCards: 'بطاقاتي',
    actionAddMoney: 'شحن',
    actionQr: 'رمز QR',
    actionBeneficiaries: 'المستفيدون',

    recentTransactions: 'آخر العمليات',
    viewAll: 'عرض الكل',
    noTransactions: 'لا توجد عمليات بعد',
    noTransactionsHint: 'ستظهر عملياتك هنا فور إتمام أول معاملة',

    financialOverview: 'الملخص المالي',
    income: 'الوارد',
    expenses: 'الصادر',

    navHome: 'الرئيسية',
    navPayments: 'المدفوعات',
    navCards: 'البطاقات',
    navTransfers: 'التحويلات',
    navProfile: 'حسابي',

    statusPending: 'قيد المعالجة',
    statusCompleted: 'مكتملة',
    statusFailed: 'فاشلة',
    statusReversed: 'معكوسة',
    statusUnderReview: 'قيد المراجعة',

    categoryFood: 'مطاعم',
    categoryShopping: 'تسوق',
    categoryTransport: 'مواصلات',
    categoryBills: 'فواتير',
    categoryEntertainment: 'ترفيه',
    categoryTransfer: 'تحويل',
    categoryIncome: 'دخل',
    categoryOther: 'أخرى',

    welcomeTitle: 'أهلاً بك في نَبض',
    createAccount: 'إنشاء حساب',
    signIn: 'تسجيل الدخول',

    errorGeneric: 'حدث خطأ. حاول مرة أخرى.',
    errorNetwork: 'تعذّر الاتصال. تحقق من اتصالك بالإنترنت.',
    errorInsufficientFunds: 'الرصيد غير كافٍ',
    retry: 'إعادة المحاولة',

    /** Shown in-app. NABD is not a licensed bank and must never imply it is. */
    regulatoryNotice: 'نَبض منصة تقنية مالية وليست بنكًا مرخّصًا.',
  },

  en: {
    appName: 'NABD',
    tagline: 'FinTech Platform',

    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',

    totalBalance: 'Total balance',
    availableBalance: 'Available balance',
    hideBalance: 'Hide balance',
    showBalance: 'Show balance',
    balanceHidden: '••••••',
    heldAmount: 'On hold',

    sendToPhone: 'Send to a phone number',
    recipientPhone: 'Recipient phone number',
    confirmRecipient: 'Confirm recipient',
    sendingTo: 'Sending to',
    instantFree: 'Instant and free',
    amountToSend: 'Amount',
    confirmAndSend: 'Confirm and send',
    recipientNotFound: 'No NABD user with that number',
    walletTier: 'Wallet tier',
    remainingToday: 'Remaining today',
    upgradeToRaise: 'Upgrade your verification to raise this limit',
    verifyIdentity: 'Verify identity',
    // top-up
    topUpTitle: 'Add money',
    topUpSource: 'Method',
    sourceCard: 'mada or credit card',
    sourceBankTransfer: 'Bank transfer',
    sourceApplePay: 'Apple Pay',
    topUpPending: 'Awaiting provider confirmation',
    topUpPendingHint: 'Your balance updates only once the funds are confirmed',
    topUpDone: 'Money added',

    // qr
    myQr: 'My code',
    scanQr: 'Scan',
    myQrHint: 'Let someone scan this to send you money',
    requestAmount: 'Request an amount',
    scanning: 'Point the camera at a code',
    qrInvalid: 'Invalid or damaged code',
    qrNotNabd: 'This is not a NABD code',
    qrSelfPay: 'You cannot pay yourself',
    qrAlreadyPaid: 'This code has already been paid',
    payMerchant: 'Pay',

    // cards
    cardsTitle: 'Cards',
    cardVirtual: 'Virtual card',
    cardPhysical: 'Physical card',
    freezeCard: 'Freeze',
    unfreezeCard: 'Unfreeze',
    cardFrozen: 'Frozen',
    cardActive: 'Active',
    cardBlocked: 'Blocked',
    newCard: 'New card',
    cardSpendsFromWallet: 'Spends directly from your wallet balance',
    cardLimits: 'Limits',

    // kyc
    kycTitle: 'Verify your identity',
    kycWhy: 'Verification raises your wallet limits and enables transfers',
    kycIdFront: 'ID front',
    kycIdBack: 'ID back',
    kycSelfie: 'Selfie',
    kycProofAddress: 'Proof of address',
    kycUpload: 'Upload',
    kycUploaded: 'Uploaded',
    kycSubmit: 'Submit for review',
    kycUnderReview: 'Under review',
    kycUnderReviewHint: 'Usually less than 24 hours',
    kycVerified: 'Verified',
    kycRejected: 'Rejected',
    kycMissing: 'Missing',

    // transaction detail
    transactionDetail: 'Transaction detail',
    reference: 'Reference',
    dateTime: 'Date and time',
    from: 'From',
    to: 'To',
    copyReference: 'Copy reference',
    reportProblem: 'Report a problem',

    actionTransfer: 'Transfer',
    actionPay: 'Pay',
    actionCards: 'Cards',
    actionAddMoney: 'Add money',
    actionQr: 'QR',
    actionBeneficiaries: 'Beneficiaries',

    recentTransactions: 'Recent transactions',
    viewAll: 'View all',
    noTransactions: 'No transactions yet',
    noTransactionsHint: 'Your activity will appear here after your first transaction',

    financialOverview: 'Financial overview',
    income: 'Income',
    expenses: 'Expenses',

    navHome: 'Home',
    navPayments: 'Payments',
    navCards: 'Cards',
    navTransfers: 'Transfers',
    navProfile: 'Profile',

    statusPending: 'Pending',
    statusCompleted: 'Completed',
    statusFailed: 'Failed',
    statusReversed: 'Reversed',
    statusUnderReview: 'Under review',

    categoryFood: 'Food',
    categoryShopping: 'Shopping',
    categoryTransport: 'Transport',
    categoryBills: 'Bills',
    categoryEntertainment: 'Entertainment',
    categoryTransfer: 'Transfer',
    categoryIncome: 'Income',
    categoryOther: 'Other',

    welcomeTitle: 'Welcome to NABD',
    createAccount: 'Create account',
    signIn: 'Sign in',

    errorGeneric: 'Something went wrong. Please try again.',
    errorNetwork: 'Cannot connect. Check your internet connection.',
    errorInsufficientFunds: 'Insufficient funds',
    retry: 'Retry',

    regulatoryNotice: 'NABD is a financial technology platform, not a licensed bank.',
  },
} as const;

export type StringKey = keyof (typeof strings)['ar'];

export function t(locale: Locale, key: StringKey): string {
  return strings[locale][key];
}

export function isRtl(locale: Locale): boolean {
  return locale === 'ar';
}

/**
 * Apply layout direction.
 *
 * React Native needs a reload for `forceRTL` to take effect, so this is called
 * during startup before the first render — flipping it later leaves the app in
 * a half-mirrored state.
 */
export function applyDirection(locale: Locale): void {
  const rtl = isRtl(locale);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
  }
}

export function greetingFor(locale: Locale, date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return t(locale, 'greetingMorning');
  if (hour < 18) return t(locale, 'greetingAfternoon');
  return t(locale, 'greetingEvening');
}
