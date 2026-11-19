# النشر — Supabase + Vercel

## 1) Supabase (قاعدة البيانات والدخول والملفات)

1. أنشئ مشروعاً في منطقة قريبة (مثلاً `eu-central-1` أو `me-central-1` إن توفرت).
2. من مجلد `samat`:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Auth:**
   - URL Configuration: Site URL = رابط موقعك، وأضف `https://<موقعك>/**` في Redirect URLs.
   - SMTP مخصص (Resend مثلاً)، وقالبا **Magic Link** و**Confirm signup** يحتويان `{{ .Token }}` (انظر `supabase/templates/magic_link.html`).
   - (اختياري) Phone provider + Send SMS Hook ← `https://<موقعك>/api/hooks/send-sms`.
4. **Database ← Extensions:** تأكد أن `pg_cron` مفعّل؛ الـ migration يجدول المهام تلقائياً إن أمكن.

## 2) Vercel (الموقع)

1. استورد المستودع، و**Root Directory = `samat`**، والإطار Next.js.
2. أضف متغيرات البيئة من `.env.example` (Production). لا ترفع أي مفتاح إلى GitHub.
3. `vercel.json` يجدول `/api/cron` يومياً (خطة Hobby تسمح بمرة يومياً). انتهاء الطلبات غير المدفوعة يتم كل دقيقة عبر pg_cron داخل Supabase.
4. بعد النشر:
   - حدّث `NEXT_PUBLIC_SITE_URL`.
   - أضف Webhook ميسّر إذا فعّلته.
   - ادخل `/admin/login` ببريد المالك.

## 3) قائمة فحص الإطلاق

- [ ] `PAYMENT_PROVIDER=moyasar`، وليس `simulator`، والمحاكي يرجع 404 تلقائياً في الإنتاج
- [ ] لم يُشغَّل `seed-demo.sql`، وشريط "بيانات تجريبية" مطفأ من الإعدادات
- [ ] بيانات الفرع وأوقات العمل والرقم الضريبي
- [ ] بيانات الحساب البنكي وصورة QR (إن كان التحويل مفعلاً)
- [ ] البريد يرسل فعلياً (اطلب طلباً تجريبياً وتأكد من وصول بريد "طلب جديد")
- [ ] المنتجات منشورة بأسعارها النهائية، والمخزون مُدخل
- [ ] دعوة الموظفين بأدوارهم
- [ ] تجربة جهاز المطبخ (تابلت) وشاشة الاستلام
- [ ] نطاق مخصص + HTTPS

## 4) النسخ الاحتياطي

Supabase يأخذ نسخاً احتياطية يومية في الخطط المدفوعة. للبيانات الحساسة (الطلبات والفواتير) يُنصح بخطة Pro لتفعيل Point-in-Time Recovery.
