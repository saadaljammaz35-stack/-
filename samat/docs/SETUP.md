# الإعداد — SAMAT

## 1) المتطلبات

- Node.js 22 أو أحدث
- حساب [Supabase](https://supabase.com) (مشروع واحد للإنتاج)
- للتطوير المحلي: Docker + Supabase CLI (`npx supabase`)

## 2) قاعدة البيانات

```bash
cd samat
npx supabase link --project-ref <PROJECT_REF>   # مرة واحدة
npx supabase db push                            # يطبق كل ملفات supabase/migrations
```

ملفات الـ migration تنشئ: كل الجداول، القيود، سياسات RLS، الدوال، الصلاحيات والأدوار، الأقسام الثلاثة (برغر/شاورما/بطاطس)، مكتبة المكونات والصوصات بصورها (بدون أسعار)، مخازن الملفات، ومهام pg_cron (انتهاء الطلبات غير المدفوعة كل دقيقة وانتهاء النقاط يومياً).

> **لا تشغّل** `supabase/demo/seed-demo.sql` على قاعدة الإنتاج — أسعاره ومنتجاته تجريبية للاختبار فقط.

## 3) متغيرات البيئة

انسخ `.env.example` إلى `.env.local` (محلياً) أو أضفها في إعدادات Vercel (إنتاج):

| المتغير | من وين | ملاحظات |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع | مثل `https://samat.sa` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | عامّة |
| `SUPABASE_SERVICE_ROLE_KEY` | نفس الصفحة | **سرّي — للخادم فقط** |
| `SUPER_ADMIN_EMAIL` | بريد المالك | أول من يدخل بهذا البريد (بعد التحقق برمز) يصير المالك |
| `PAYMENT_PROVIDER` | `moyasar` | `simulator` للتطوير فقط ويُرفض في الإنتاج |
| `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY` / `MOYASAR_SECRET_KEY` / `MOYASAR_WEBHOOK_SECRET` | لوحة ميسّر | اختياري إذا كان الدفع تحويل بنكي فقط |
| `EMAIL_PROVIDER` + `RESEND_API_KEY` + `EMAIL_FROM` | Resend | أو SMTP |
| `SMS_PROVIDER` + مفاتيح المزوّد | Unifonic / Taqnyat / Twilio | لرموز الجوال ورسائل الطلبات |
| `SEND_SMS_HOOK_SECRETS` | Supabase → Auth → Hooks | يُنسخ من إعداد الـ Hook |
| `WHATSAPP_*` | Meta WhatsApp Cloud API | اختياري |
| `ANTHROPIC_API_KEY` | console.anthropic.com | لتشغيل SAMAT AI |
| `CRON_SECRET` | أي نص عشوائي طويل | يحمي `/api/cron` |
| `PRINT_BRIDGE_TOKEN` | أي نص عشوائي طويل | لجسر طابعة الشبكة |

## 4) حساب المالك (Owner)

1. ضع بريدك في `SUPER_ADMIN_EMAIL`.
2. افتح `/admin/login` واكتب نفس البريد → يصلك رمز من ٦ أرقام → أدخله.
3. قاعدة البيانات تتحقق أن البريد **مؤكد** وأنه يطابق `SUPER_ADMIN_EMAIL` ثم تمنحك دور المالك.
4. لا يوجد تسجيل مفتوح للوحة: أي بريد آخر يدخل لازم تكون دعوته من صفحة **الموظفين**.

## 5) قوالب بريد الدخول (مهم للإنتاج)

في Supabase → Authentication → Email Templates، استبدل قالبي **Magic Link** و**Confirm signup** بمحتوى
`supabase/templates/magic_link.html` (فيه الرمز `{{ .Token }}`)، لأن الموظفين يدخلون برمز من ٦ أرقام وليس برابط.
وفي Authentication → SMTP ربط SMTP خاص (مثلاً Resend SMTP) لأن بريد Supabase الافتراضي محدود جداً.

## 6) دخول العملاء برقم الجوال (اختياري)

1. Supabase → Authentication → Providers → **Phone**: فعّله.
2. Authentication → Hooks → **Send SMS hook** → HTTPS → `https://<موقعك>/api/hooks/send-sms`، وانسخ الـ secret إلى `SEND_SMS_HOOK_SECRETS`.
3. فعّل مزود SMS في متغيرات البيئة (`SMS_PROVIDER=unifonic` مثلاً). الموقع هو اللي يرسل الرمز عبر مزودك، فتقدر تستخدم أي مزود سعودي.

بدون مزود SMS: الطلب كضيف يشتغل عادي، وصفحة "حسابي" تعرض رسالة أن الرسائل غير مفعّلة.

## 7) أول إعدادات من لوحة الإدارة

1. **الإعدادات**: اسم الفرع، العنوان ورابط الخريطة، أوقات العمل، إيميلات الإدارة، الرقم الضريبي والسجل التجاري، وسائل الدفع وبيانات الحساب البنكي وصورة QR التحويل.
2. **المخزون**: أضف الأصناف (لحم، خبز، صوصات، بطاطس…) وكمياتها.
3. **المكونات والصوصات**: حدد أسعار الإضافات واربط كل مكون بصنف المخزون.
4. **المنتجات**: أنشئ البرغر والشاورما والبطاطس، ركّب المكونات، حدد السعر ثم فعّل "منشور في المنيو".
5. **النقاط والكوبونات** حسب رغبتك.
