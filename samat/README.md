# SAMAT | سماط

منصة طلبات ومطعم متكاملة لعلامة **سماط**: متجر بالعربية (لهجة نجدية) والإنجليزية، مصمم برغر وشاورما تفاعلي بطبقات صور حقيقية، سلة ودفع (تحويل بنكي مع رفع الإيصال، وميسّر جاهز للتفعيل)، موافقة يدوية على كل طلب، شاشة مطبخ، رقم استلام وQR، شاشة استلام، لوحة إدارة كاملة بالصلاحيات، مخزون، كوبونات، نقاط ولاء، فواتير وطباعة، ومساعد ذكاء اصطناعي **SAMAT AI**.

> الاستلام من الفرع فقط — لا يوجد توصيل.

## التقنيات

| الطبقة | التقنية |
|---|---|
| الواجهة والخادم | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion |
| قاعدة البيانات | Supabase Postgres 17 · RLS على كل الجداول · دوال SQL للعمليات المالية والمخزون |
| الدخول | Supabase Auth — الموظفون برمز بريد، والعملاء برمز جوال (اختياري) |
| اللحظي | Supabase Realtime (جدول `order_board` بدون بيانات شخصية) + polling احتياطي |
| الملفات | Supabase Storage (`menu` عام، `receipts` خاص، `assets` عام) |
| الدفع | تحويل بنكي + رفع إيصال · Moyasar (تفويض/تحصيل/إلغاء/استرجاع + Webhook) |
| الإشعارات | Resend أو SMTP · Unifonic / Taqnyat / Twilio · WhatsApp Cloud API |
| الذكاء الاصطناعي | Claude API (`claude-opus-5-5`) عبر `@anthropic-ai/sdk` مع أدوات تقرأ قاعدة البيانات |

## تشغيل سريع (محلياً)

```bash
cd samat
npm install
npx supabase start                       # يتطلب Docker
npx supabase db reset                    # يطبق كل الـ migrations
psql "$DB_URL" -f supabase/demo/seed-demo.sql   # بيانات تجريبية للاختبار فقط (اختياري)
cp .env.example .env.local               # واملأ القيم (انظر docs/SETUP.md)
npm run dev                              # http://localhost:3000
```

- المتجر: `/` · المنتج: `/p/<slug>` · السلة: `/cart` · تتبع الطلب: `/t/<token>`
- الإدارة: `/admin` · المطبخ: `/kitchen` · شاشة الاستلام: `/pickup-screen`

## الأوامر

| الأمر | الوصف |
|---|---|
| `npm run dev` / `build` / `start` | تشغيل / بناء / إنتاج |
| `npm run typecheck` | فحص الأنواع |
| `npm test` | اختبارات الوحدات (Vitest) |
| `npm run test:db` | اختبارات قاعدة البيانات (تحتاج Supabase محلي) |
| `npm run test:e2e` | اختبارات المتصفح الشاملة (Playwright) |
| `npm run images:build` | تحسين صور الطبقات والأيقونات |
| `npm run print-bridge` | جسر الطباعة لطابعة الشبكة (LAN) في الفرع |

## الوثائق

- [docs/SETUP.md](docs/SETUP.md) — الإعداد والمتغيرات وحساب المالك
- [docs/PAYMENTS.md](docs/PAYMENTS.md) — التحويل البنكي وميسّر وApple Pay والاسترجاع
- [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) — البريد وSMS وواتساب ورموز الدخول
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — الموظفون، المنيو، المخزون، النقاط، الكوبونات، الزحمة، المطبخ، QR، الطابعة، SAMAT AI
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — النشر على Supabase + Vercel
- [docs/TEST-REPORT.md](docs/TEST-REPORT.md) — تقرير الاختبارات والمشكلات المتبقية
- [docs/NEEDED-FROM-OWNER.md](docs/NEEDED-FROM-OWNER.md) — ما نحتاجه منك للتفعيل الكامل

## مبادئ لا تتغير في هذا المشروع

- **السعر يُحسب في قاعدة البيانات فقط** (`place_order`) — المتصفح يعرض معاينة فقط.
- **الخبز لا يُحذف**: قيد في الواجهة وقيد في قاعدة البيانات (`base_required` / `bread_required`).
- **كل طلب يحتاج موافقة يدوية** قبل أن يصل للمطبخ.
- **المخزون يُحجز** عند إنشاء الطلب بقفل صفوف، **ويُخصم** عند القبول فقط، **ويُرجع** عند الرفض أو انتهاء مهلة الدفع.
- **لا تُخزن بيانات البطاقات** إطلاقاً، وإيصالات التحويل في مخزن خاص بروابط مؤقتة.
- **الصلاحيات تُفحص في الخادم وفي قاعدة البيانات** (RLS + `require_permission`)، وليس بإخفاء الأزرار.
- **لا أسعار مخترعة**: الأسعار الموجودة في `supabase/demo/seed-demo.sql` للاختبار فقط، ويظهر شريط "بيانات تجريبية" ما دامت مفعلة.
