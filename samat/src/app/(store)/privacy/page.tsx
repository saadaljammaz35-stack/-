import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n/server';
import { getPublicSettings } from '@/lib/catalog';
import { LegalPage } from '@/components/store/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDict();
  return { title: locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy' };
}

export default async function Privacy() {
  const [{ locale }, s] = await Promise.all([getDict(), getPublicSettings()]);
  const contact = s.phone ? (locale === 'ar' ? `جوال الفرع: ${s.phone}` : `branch phone: ${s.phone}`) : (locale === 'ar' ? 'الفرع مباشرة' : 'the branch directly');
  const ar = [
    { h: 'وش نجمع', p: ['اسمك ورقم جوالك وبريدك (اختياري) وتفاصيل طلبك، وصورة إيصال التحويل إذا دفعت بتحويل بنكي.', 'إذا دخلت بحساب Google ناخذ اسمك وبريدك فقط، وإذا دخلت برقم جوالك نتحقق منه برمز.'] },
    { h: 'ليش نجمعها', p: ['لتجهيز طلبك وتسليمه لك من الفرع، والتواصل معك بخصوصه، وإصدار الفاتورة، واحتساب نقاط الولاء.'] },
    { h: 'الدفع', p: ['الدفع بالبطاقة (إذا كان متاحاً) يتم عبر بوابة دفع مرخّصة، ولا نخزّن بيانات بطاقتك. إيصالات التحويل محفوظة بشكل خاص ولا يشوفها إلا فريق المطعم.'] },
    { h: 'مع من نشاركها', p: ['ما نبيع بياناتك. نستخدم مزوّدي خدمة لتشغيل الموقع (الاستضافة وقاعدة البيانات، وخدمة الرسائل والبريد إذا كانت مفعّلة، وGoogle لتسجيل الدخول)، ويعالجون البيانات لهذا الغرض فقط.'] },
    { h: 'مدة الاحتفاظ', p: ['نحتفظ بالطلبات والفواتير المدة اللي يتطلبها النظام. وتقدر تطلب حذف حسابك وبياناتك اللي ما يلزمنا الاحتفاظ بها.'] },
    { h: 'حقوقك والتواصل', p: [`لك حق الاطلاع على بياناتك وتصحيحها وطلب حذفها. تواصل معنا عن طريق ${contact}.`] },
  ];
  const en = [
    { h: 'What we collect', p: ['Your name, mobile number, e-mail (optional) and order details, plus the transfer receipt image if you pay by bank transfer.', 'If you sign in with Google we receive only your name and e-mail; if you sign in with your mobile we verify it with a code.'] },
    { h: 'Why', p: ['To prepare your order and hand it over at the branch, contact you about it, issue the invoice and calculate loyalty points.'] },
    { h: 'Payments', p: ['Card payments (when available) go through a licensed payment gateway; we never store card details. Transfer receipts are stored privately and seen only by the restaurant team.'] },
    { h: 'Sharing', p: ['We do not sell your data. Service providers run the site for us (hosting and database, SMS and e-mail when enabled, Google for sign-in) and process data only for that purpose.'] },
    { h: 'Retention', p: ['Orders and invoices are kept for as long as the law requires. You can ask us to delete your account and any data we are not required to keep.'] },
    { h: 'Your rights and contact', p: [`You can access, correct and ask us to delete your data. Contact ${contact}.`] },
  ];
  return <LegalPage title={locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'} updated={locale === 'ar' ? 'آخر تحديث: نوفمبر ٢٠٢٦' : 'Last updated: November 2026'} sections={locale === 'ar' ? ar : en} />;
}
