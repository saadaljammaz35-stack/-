<div dir="rtl">

# مَحَلّك | MAHALLAK

**كل شيء له مكان.** — ذاكرة ذكية لممتلكاتك: صوّر أغراضك، سجّل أماكنها، واسأل عنها بلهجتك: «وين حطيت سماعتي؟».

<p align="center"><img src="assets/brand/logo-full-dark.png" width="220" alt="مَحَلّك"/></p>

## ما الذي بُني

| المكوّن | الحالة |
|---|---|
| تطبيق React Native (Expo SDK 58، TypeScript، Expo Router) لـ iOS وأندرويد والويب | ✅ مكتمل، يعمل محلياً بدون أي حساب |
| نظام تصميم زجاجي أصلي (Liquid Glass الأصلي على iOS 26، ضبابية حية، وضع فاتح/داكن، تقليل الشفافية والحركة) | ✅ |
| 15 شاشة + Smart Room Memory | ✅ |
| طبقة فهم اللهجات السعودية (نجدية، حجازية، شرقية، جنوبية، شمالية) قابلة للتحديث بدون إعادة بناء | ✅ مع تقرير تقييم |
| بحث صوتي ونصي وبالصورة، لا يخترع نتائج | ✅ |
| قاعدة بيانات Supabase مع RLS وتخزين خاص وترحيلات | ✅ مختبرة على Supabase محلي حقيقي |
| Edge Functions للذكاء الاصطناعي (Claude) والحذف والتصدير والمشتريات | ✅ مختبرة بخادم Claude محاكى |
| تسجيل الدخول: Apple / Google / الجوال OTP | ✅ الكود جاهز؛ يحتاج مفاتيحك |
| الشراء مرة واحدة (RevenueCat) | ✅ الكود جاهز؛ يحتاج منتجات المتجر |
| ملف APK للاختبار (arm64، موقّع بمفتاح الاختبار) | ✅ بُني محلياً بـ Gradle — التفاصيل والبصمة في `reports/TEST-REPORT.md` |
| ملف IPA | ⏳ يحتاج حساب Apple Developer وحساب Expo — [docs/BUILD.md](docs/BUILD.md) |

## هيكل المشروع

```
MAHALLAK/
├── src/
│   ├── app/                  # الشاشات (Expo Router): splash، onboarding، sign-in، (tabs)/…، voice، add/…، item/[id]/…
│   ├── design/               # نظام التصميم الزجاجي: tokens، Glass، MicOrb، TabBar، Icon، Logo
│   ├── features/dialect/     # فهم اللهجات: normalize، lexicon، parser، lexiconProvider + التقييم
│   ├── features/search/      # محرك البحث في أغراض المستخدم
│   ├── services/             # auth، sync، ai، speech، media، purchase، account
│   ├── data/                 # التخزين المحلي (SQLite / localStorage على الويب / ذاكرة للاختبار)
│   ├── domain/               # النماذج والفئات والألوان والغرف
│   ├── i18n/                 # العربية (أساسية) والإنجليزية، RTL
│   └── state/                # zustand
├── supabase/
│   ├── migrations/           # SQL: الجداول، RLS، التخزين الخاص، الدوال
│   ├── functions/            # Edge Functions (Deno)
│   └── tests/                # أداة تشغيل الدوال محلياً للاختبار
├── assets/brand/             # الشعار SVG وPNG + مرجع الهوية
├── assets/images/            # أيقونات التطبيق وأندرويد التكيفية وشاشة البداية
├── assets/mahallak.icon/     # أيقونة iOS 26 (Icon Composer)
├── tools/brand/              # مولّد الأصول (الشعار يُرسم كمتجهات والنص العربي يُشكَّل بـ HarfBuzz)
├── reports/                  # تقارير الاختبارات واللهجات ولقطات الشاشات
├── docs/                     # البناء، التكلفة، الخصوصية، البنية
├── app.json · app.config.ts · eas.json · .env.example
```

## التشغيل السريع

```bash
cd MAHALLAK
npm install
cp .env.example .env.local      # اختياري: بدون مفاتيح يعمل التطبيق محلياً بالكامل
npx expo start                  # ثم افتح على الويب أو بناء تطوير
```

> التطبيق يستخدم وحدات أصلية (الكاميرا، التعرّف على الكلام، تسجيل الدخول، الشراء) فلا يعمل في Expo Go. استخدم بناء تطوير:
> `npx eas-cli build --profile development -p ios` أو `npx expo run:android`.

## تجهيز الخادم (Supabase)

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push                                   # يطبّق supabase/migrations
npx supabase secrets set --env-file supabase/functions/.env   # انسخ من .env.example
npx supabase functions deploy                          # كل الدوال
```

ثم في لوحة Supabase → Authentication → Providers:

- **Apple**: فعّله وأضف Bundle ID ‏`com.mahallak.app` (تسجيل دخول أصلي بـ ID token، لا يحتاج سراً للتطبيق الأصلي).
- **Google**: فعّله وأضف Client IDs (الويب + iOS) واملأ `EXPO_PUBLIC_GOOGLE_*`.
- **Phone**: فعّله واختر مزوّد SMS (Twilio / MessageBird / Vonage …) مع مرسل معتمد للسعودية.
- **RevenueCat**: أنشئ Webhook إلى `https://<ref>.supabase.co/functions/v1/revenuecat-webhook` بترويسة Authorization = قيمة `REVENUECAT_WEBHOOK_AUTH`.

## الاختبارات والتقارير

```bash
npm run typecheck          # TypeScript
npm run test:ci            # الوحدة + السيناريو + تقييم اللهجات → reports/jest-results.json
npm run dialect:eval       # reports/dialect-eval.md
# تكامل الخادم على Supabase محلي (Docker):
npx supabase start && npm run supabase:harness &
SUPABASE_IT_URL=... SUPABASE_IT_ANON_KEY=... SUPABASE_IT_SERVICE_KEY=... SUPABASE_IT_FUNCTIONS_URL=http://127.0.0.1:54400/functions/v1 npm run test:integration
npm run report:tests       # reports/TEST-REPORT.md
```

- [تقرير الاختبارات](reports/TEST-REPORT.md)
- [تقرير تقييم اللهجات](reports/dialect-eval.md)
- [لقطات كل الشاشات — فاتح](reports/screenshots/all-screens-light.jpg) · [داكن](reports/screenshots/all-screens-dark.jpg)

## تحسين فهم اللهجات بدون تحديث التطبيق

القاموس بيانات JSON بإصدارات. لنشر إصدار أحدث (يُضاف إلى القاموس المدمج ولا يحذف منه):

```sql
insert into public.dialect_lexicons (version, is_active, payload, notes)
values (2, true, '{"version":2,"markers":{},"items":[{"id":"stapler","category":"tools","terms":["دباسه","دباسة"]}]}', 'إضافة الدباسة');
```

يجلبه التطبيق عند الفتح ويحفظه للعمل بدون إنترنت. ابدأ بالحالات الفاشلة في `reports/dialect-eval.md`، ثم أضف عبارات حقيقية من مستخدمين من كل منطقة إلى `src/features/dialect/__fixtures__/dialect-corpus.ts` وأعد التقييم.

## الخصوصية باختصار

- كل شيء يُحفظ على الجهاز أولاً. النسخ السحابي **اختياري**، ورفع صور المنزل **إذن منفصل** متوقف افتراضياً.
- الصوت لا يُرفع ولا يُحفظ أبداً؛ يُحوَّل لنص بواسطة مُعرِّف النظام.
- الذكاء الاصطناعي لا يعمل إلا بموافقة صريحة تُتحقق منها على الخادم؛ استخدام البيانات للتدريب متوقف دائماً.
- RLS يمنع أي مستخدم من رؤية بيانات غيره؛ الصور في حاويات خاصة بمجلد لكل مستخدم.
- تصدير كامل للبيانات وحذف الحساب وكل ما يرتبط به من داخل التطبيق.
- التفاصيل: [docs/PRIVACY.md](docs/PRIVACY.md).

## نموذج الربح

شراء مرة واحدة (السعر الموصى به 29 ريالاً مع اختبار 19/29/39 عبر RevenueCat Experiments). الذكاء الاصطناعي السحابي رصيد محدد مشمول — لا نعد باستخدام سحابي غير محدود مدى الحياة. الحسابات الكاملة: [docs/COST-MODEL.md](docs/COST-MODEL.md).

## ما المطلوب منك للحصول على IPA

انظر [docs/BUILD.md](docs/BUILD.md). باختصار: حساب Apple Developer (99$ سنوياً)، حساب Expo، ثم `eas init` و`eas build -p ios --profile preview` (للتثبيت على أجهزة مسجلة) أو `--profile production` (لـ TestFlight/App Store). EAS يتولى الشهادة وملف التوزيع.

</div>
