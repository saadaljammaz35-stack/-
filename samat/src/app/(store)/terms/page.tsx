import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n/server';
import { LegalPage } from '@/components/store/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDict();
  return { title: locale === 'ar' ? 'الشروط والأحكام' : 'Terms' };
}

export default async function Terms() {
  const { locale } = await getDict();
  const ar = [
    { h: 'الاستلام', p: ['كل الطلبات استلام من الفرع فقط، وما عندنا توصيل.'] },
    { h: 'قبول الطلب', p: ['كل طلب يحتاج موافقة المطعم قبل التحضير. إذا انرفض الطلب نرجّع لك المبلغ كامل.', 'في الدفع بالتحويل البنكي، نبدأ بعد ما نتأكد من وصول التحويل.'] },
    { h: 'الأسعار', p: ['السعر النهائي هو اللي يظهر في صفحة الدفع، شامل الإضافات والخصومات والضريبة حسب إعدادات المطعم.'] },
    { h: 'رمز الاستلام', p: ['رمز الاستلام ورمز QR يستخدم مرة وحدة لتسليم الطلب، فلا تعطيه لأحد غير اللي بيستلم.'] },
    { h: 'نقاط الولاء', p: ['النقاط تنضاف بعد استلام الطلب لأصحاب الحسابات، وقيمتها وشروط استخدامها حسب برنامج المطعم ويحق للمطعم تعديلها.'] },
  ];
  const en = [
    { h: 'Pickup', p: ['All orders are picked up at the branch. There is no delivery.'] },
    { h: 'Order approval', p: ['Every order needs the restaurant’s approval before it is prepared. If an order is rejected, you get a full refund.', 'For bank transfers, we start once the transfer has been confirmed.'] },
    { h: 'Prices', p: ['The final price is the one shown at checkout, including extras, discounts and VAT as configured by the restaurant.'] },
    { h: 'Pickup code', p: ['The pickup code and QR are single-use for handing over the order — keep them private.'] },
    { h: 'Loyalty points', p: ['Points are added after pickup for account holders. Their value and rules follow the restaurant’s programme, which the restaurant may change.'] },
  ];
  return <LegalPage title={locale === 'ar' ? 'الشروط والأحكام' : 'Terms'} updated={locale === 'ar' ? 'آخر تحديث: نوفمبر ٢٠٢٦' : 'Last updated: November 2026'} sections={locale === 'ar' ? ar : en} />;
}
