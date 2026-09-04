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
