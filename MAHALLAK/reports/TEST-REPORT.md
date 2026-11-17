# تقرير الاختبارات — مَحَلّك

- تاريخ التوليد: 2026-11-17T22:17:59.887Z
- Expo SDK ~58.0.26 · React Native 0.88.1 · Node v22.23.4

> هذا التقرير مولَّد آلياً من ملفات النتائج الحقيقية في `reports/`. لا يحتوي نتائج مكتوبة يدوياً.

## الملخص

| المجموعة | الإجمالي | نجح | فشل |
|---|---:|---:|---:|
| اختبارات الوحدة والسيناريو | 75 | 75 | 0 |
| تكامل الخادم (Supabase محلي حقيقي) | 23 | 23 | 0 |
| تقييم اللهجات — مجموعة التطوير | 167 | 167 | 0 |
| تقييم اللهجات — المجموعة المحجوزة | 65 | 64 | 1 |

## سيناريو الموجز (13 خطوة) — أين اختُبرت كل خطوة

| # | الخطوة | الاختبار | مستوى التحقق |
|---|---|---|---|
| 1 | إنشاء حساب | backend.int › authentication (OTP عبر Supabase Auth محلي) | خادم حقيقي محلي؛ إرسال SMS حقيقي يحتاج مزوّداً |
| 2 | تصوير سماعة | scenario.test (حفظ الصورة) + لقطات الويب للكاميرا | منطق؛ الكاميرا الفعلية تحتاج جهازاً |
| 3 | قص خلفيتها | scenario.test (حفظ الأصل + المقصوصة) + backend.int (remove-background يرد 501 بدون مزوّد) | منطق؛ مزوّد القص الحقيقي يحتاج مفتاحاً |
| 4 | تحديد اسمها | scenario.test + backend.int (ai-recognize-item مع Claude محاكى) | تحقق المخطط والموافقة والحصة؛ جودة النموذج الحقيقي غير مقاسة |
| 5 | تصوير درج المكتب | scenario.test | منطق |
| 6 | حفظ الغرض | scenario.test + backend.int (مزامنة جهازين) | تخزين محلي + سحابي حقيقي |
| 7 | إغلاق التطبيق | scenario.test (لقطة المخزن وإعادة التحميل) | محاكاة إعادة تشغيل |
| 8 | فتح التطبيق | scenario.test + backend.int (استعادة الجلسة من سلسلة المفاتيح) | منطق + خادم حقيقي |
| 9 | قول «وين حطيت سماعتي؟» | scenario.test (النص) + voiceState tests (الصوت) | التعرّف الصوتي الفعلي يحتاج جهازاً |
| 10 | ظهور الغرض وصورة المكان | scenario.test + لقطة الويب 05-voice-result | منطق + واجهة |
| 11 | نقل السماعة | scenario.test + backend.int | منطق + خادم حقيقي |
| 12 | تحديث موقعها | scenario.test + backend.int (الجهاز الثاني ينقل والأول يرى) | منطق + خادم حقيقي |
| 13 | ظهور الموقع الجديد | scenario.test + backend.int (السجل: الجديد ثم القديم) | منطق + خادم حقيقي |

## الأعطال والحالات الصعبة المختبرة

- **الضوضاء/الصمت**: آلة حالات الصوت تحوّل الصمت إلى «ما سمعت شيئاً واضحاً» وتحتفظ بالنتيجة الجزئية عند انتهاء المهلة.
- **رفض إذن الميكروفون/الكاميرا**: رسائل مخصصة + زر الإعدادات + بديل الكتابة/المعرض.
- **انقطاع الإنترنت**: البحث والحفظ يعملان محلياً؛ الذكاء الاصطناعي يرفض بـ `offline` ويُرجع النتائج المحلية؛ المزامنة تحتفظ بالتغييرات في صندوق الصادر.
- **فشل الكاميرا**: `onMountError` ينقل المستخدم لاختيار صورة من المعرض.
- **فشل الذكاء الاصطناعي/الحصة**: يبقى الإدخال اليدوي، والصورة الأصلية محفوظة دائماً.
- **عدم الاختراع**: اختبارات صريحة تتأكد أن الأغراض غير المسجلة لا تُعرض كنتيجة مؤكدة.
- **العزل بين المستخدمين**: RLS، منع تغيير المالك، منع الإشارة لصفوف مستخدم آخر، صور خاصة، سجل لا يُعدَّل.

## تقييم اللهجات

| اللهجة | المحجوزة: نجاح | التطوير: نجاح |
|---|---:|---:|
| النجدية (Najdi) | 100% (12/12) | 100% (30/30) |
| الحجازية (Hijazi) | 91.7% (11/12) | 100% (30/30) |
| الشرقية (Eastern) | 100% (12/12) | 100% (30/30) |
| الجنوبية (Southern) | 100% (12/12) | 100% (30/30) |
| الشمالية (Northern) | 100% (12/12) | 100% (30/30) |
| ضوضاء/إنجليزي/سلبي (Noise, English, negatives) | 100% (5/5) | 100% (17/17) |

التفاصيل والحالات الفاشلة: [`reports/dialect-eval.md`](dialect-eval.md).

### اختبارات الوحدة والسيناريو (Jest)

- الإجمالي: **75** — نجح **75**، فشل **0**، متجاوز 0 — المدة 4.1 ث

| الملف | الاختبار | النتيجة |
|---|---|---|
| src/__tests__/native-config.test.ts | native configuration › never disables the microphone through camera or image-picker plugins | ✅ |
| src/__tests__/native-config.test.ts | native configuration › declares every iOS usage description the app needs | ✅ |
| src/__tests__/native-config.test.ts | native configuration › requests the Android microphone and camera and never blocks them | ✅ |
| src/__tests__/native-config.test.ts | native configuration › enables Sign in with Apple and uses the same id on both platforms | ✅ |
| src/__tests__/native-config.test.ts | native configuration › localizes the permission prompts and display name in Arabic and English | ✅ |
| src/__tests__/native-config.test.ts | native configuration › has internal-testing and store build profiles | ✅ |
| src/__tests__/scenario.test.ts | brief scenario: earphones in the desk drawer › runs the full flow and survives an app restart | ✅ |
| src/__tests__/scenario.test.ts | brief scenario: earphones in the desk drawer › does not invent an answer for something never registered | ✅ |
| src/__tests__/scenario.test.ts | brief scenario: earphones in the desk drawer › asks to rephrase on noise | ✅ |
| src/i18n/__tests__/i18n.test.ts | translations › English covers every Arabic key | ✅ |
| src/i18n/__tests__/i18n.test.ts | translations › uses all six Arabic plural forms correctly | ✅ |
| src/i18n/__tests__/i18n.test.ts | translations › switches to English | ✅ |
| src/i18n/__tests__/i18n.test.ts | translations › never applies letter-spacing to Arabic copy (no zero-width tricks in strings) | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › never invents a result for items that are not registered | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › asks to rephrase instead of guessing on unclear input | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › najdi success rate is at least 85% | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › hijazi success rate is at least 85% | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › sharqi success rate is at least 85% | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › janoubi success rate is at least 85% | ✅ |
| src/features/dialect/__tests__/dialect-eval.test.ts | Saudi dialect evaluation › shamali success rate is at least 85% | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | normalizeArabic › unifies letter variants, removes diacritics and punctuation | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | normalizeArabic › converts Eastern Arabic digits and collapses elongated speech | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | normalizeArabic › lower-cases Latin text | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | stemCandidates › strips possessive suffixes and proclitics | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | fuzzy matching › computes transpositions as one edit | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | fuzzy matching › never treats short Arabic roots one letter apart as equal | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | fuzzy matching › tolerates a typo in longer words | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › وين حطيت سماعتي؟ | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › فين خليت الشاحن؟ | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › وين داري المفتاح؟ | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › أبي الثوب اللي صورته أمس | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › وش الأشياء اللي حطيتها بالدرج؟ | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › وين أغراض السفر؟ | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › understands the white charger color | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › reads "مفتاح حق السيارة" as the car key | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › detects dialect hints without requiring them | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › marks gibberish as unknown with low confidence | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | parseQuery – examples from the product brief › recognizes small talk instead of searching | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | remote lexicon updates › rejects malformed payloads | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | remote lexicon updates › extends terms without removing bundled understanding | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | remote lexicon updates › applies a newer cached/remote lexicon and keeps working offline | ✅ |
| src/features/dialect/__tests__/dialect.test.ts | remote lexicon updates › ignores remote versions that are not newer | ✅ |
| src/__tests__/sync-mapping.test.ts | sync field mapping (device <-> server) › round-trips an item without losing fields | ✅ |
| src/__tests__/sync-mapping.test.ts | sync field mapping (device <-> server) › round-trips a place and a placement snapshot | ✅ |
| src/__tests__/sync-mapping.test.ts | sync field mapping (device <-> server) › keeps the local file path when the server copy has none | ✅ |
| src/__tests__/services.test.ts | ItemService validation › requires a name and a place | ✅ |
| src/__tests__/services.test.ts | ItemService validation › rejects unknown categories and colors | ✅ |
| src/__tests__/services.test.ts | ItemService validation › trims, deduplicates keywords and queues sync work | ✅ |
| src/__tests__/services.test.ts | ItemService validation › soft-deletes and exports without local file paths | ✅ |
| src/__tests__/services.test.ts | ItemService validation › wipes everything on account deletion | ✅ |
| src/__tests__/services.test.ts | search pipeline with optional AI fallback › finds custom item names that are not in the lexicon | ✅ |
| src/__tests__/services.test.ts | search pipeline with optional AI fallback › uses the AI only to restructure an unclear question, never to invent results | ✅ |
| src/__tests__/services.test.ts | search pipeline with optional AI fallback › falls back to local results when the AI fails or the user is offline | ✅ |
| src/__tests__/services.test.ts | AI client gatekeeping and response validation › refuses without consent, sign-in or network | ✅ |
| src/__tests__/services.test.ts | AI client gatekeeping and response validation › maps quota errors | ✅ |
| src/__tests__/services.test.ts | AI client gatekeeping and response validation › sanitizes model output | ✅ |
| src/__tests__/services.test.ts | AI client gatekeeping and response validation › pre-selects only confident room-scan detections | ✅ |
| src/__tests__/services.test.ts | phone numbers › 0501234567 -> +966501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › 501234567 -> +966501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › 966501234567 -> +966501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › +966 50 123 4567 -> +966501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › ٠٥٠١٢٣٤٥٦٧ -> +966501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › 00971501234567 -> +971501234567 | ✅ |
| src/__tests__/services.test.ts | phone numbers › rejects 0112345678 | ✅ |
| src/__tests__/services.test.ts | phone numbers › rejects +966112345678 | ✅ |
| src/__tests__/services.test.ts | phone numbers › rejects 123 | ✅ |
| src/__tests__/services.test.ts | phone numbers › rejects abc | ✅ |
| src/__tests__/services.test.ts | session storage in the secure keychain › splits large sessions into chunks and restores them exactly | ✅ |
| src/__tests__/services.test.ts | session storage in the secure keychain › treats a half-written session as signed out | ✅ |
| src/__tests__/services.test.ts | voice search state machine (noise, permissions, failures) › goes from listening to processing with the final transcript | ✅ |
| src/__tests__/services.test.ts | voice search state machine (noise, permissions, failures) › reports denied microphone permission | ✅ |
| src/__tests__/services.test.ts | voice search state machine (noise, permissions, failures) › reports silence / pure noise as no speech | ✅ |
| src/__tests__/services.test.ts | voice search state machine (noise, permissions, failures) › keeps a usable partial result when the recognizer times out | ✅ |
| src/__tests__/services.test.ts | voice search state machine (noise, permissions, failures) › surfaces network failures and treats user abort as a reset | ✅ |
| src/__tests__/services.test.ts | settings › never enables training consent or photo backup implicitly | ✅ |

### تكامل الخادم مع Supabase محلي (Docker)

- الإجمالي: **23** — نجح **23**، فشل **0**، متجاوز 0 — المدة 0.0 ث

| الملف | الاختبار | النتيجة |
|---|---|---|
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › authentication › creates a profile and private settings row on sign-up | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › authentication › rejects a wrong OTP | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › authentication › restores the session from the secure keychain after an app restart, refreshes it, and signs out | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › pushes items, places, history and photos from device 1 | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › pulls everything onto device 2, then device 2 moves the item and device 1 sees it | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › another user sees none of it and cannot touch it | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › anonymous visitors read nothing private | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › history is append-only for clients | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › photos are private: owner can read, others and the public cannot | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › reports only the caller's own photo usage (backup cap check) | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › two devices, one account, and isolation from other users › quota functions are not callable from the app | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › serves a newer dialect lexicon to the app without a rebuild | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › requires sign-in | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › requires the user's explicit AI consent, checked on the server | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › recognizes an item after consent and validates the output | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › rejects anything that is not a JPEG/PNG photo | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › detects several items for Smart Room Memory and keeps uncertain ones flagged | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › restructures an unclear dialect question | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › reports background removal as not configured instead of faking it | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › enforces the monthly free quota | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › AI edge functions (Claude API mocked locally) › unlocks the paid tier only from an authenticated store webhook | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › data export and account deletion › exports everything the user owns, with photo links | ✅ |
| src/__tests__/integration/backend.int.test.ts | MAHALLAK backend (local Supabase) › data export and account deletion › deletes the account, every row and every photo | ✅ |

## بناء الواجهات (ويب) والمراجعة البصرية

- تصدير الويب: expo export --platform web (OK) — 20 شاشة × وضعين (فاتح/داكن) بدون أخطاء JavaScript في الصفحة.

## بناء أندرويد

- الحالة: **BUILD SUCCESSFUL — APK verified with aapt2 + apksigner**
- file: `MAHALLAK-1.0.0-arm64-test.apk`
- bytes: `46543655`
- sha256: `a8bb339c02f17548b4fea9a40e90caa82d8a4bcad5a88dcf8f8456e4c308118d`
- package: `com.mahallak.app 1.0.0 (minSdk 24, targetSdk 36)`
- abi: `arm64-v8a (covers practically all current Android phones)`
- signing: `debug keystore — for installing on test devices only, NOT for Google Play`
- permissions: `CAMERA, RECORD_AUDIO, INTERNET, VIBRATE, BILLING (+ network state from libraries)`
- backend: `built without EXPO_PUBLIC_* keys: runs fully on-device; sign-in, cloud sync, AI and purchases show 'not configured'`
- launched_on_device: `no — this sandbox has no KVM for an emulator and no physical device`
- built_with: `Gradle 9.4.1, AGP 9.2.1, JDK 21, Android SDK 37, NDK 27.1.12297006, Hermes`

## بناء iOS

- status: `EAS Build FINISHED — IPA downloaded and inspected`
- file: `MAHALLAK.ipa`
- bytes: `25154721`
- sha256: `73bbb8cbe5c6a89f68541698c75e6f57941727802029f8f7cfef75c7c1a847bb`
- eas_build: `https://expo.dev/accounts/saadaljgaded/projects/mahallak/builds/1cad8b13-784f-4335-9e02-4b64e2bbaa9a`
- bundle: `com.mahallak.app 1.0.0 (1), MinimumOSVersion 16.4, iphoneos SDK 27.1, arm64, Hermes`
- signing: `UNSIGNED (built with CODE_SIGNING_ALLOWED=NO) — install with Sideloadly/AltStore, which sign it with the installer's Apple ID; not for the App Store`
- permissions: `NSCamera / NSMicrophone / NSSpeechRecognition / NSPhotoLibrary usage descriptions present, Arabic + English localizations`
- limits: `free Apple ID signing expires after 7 days; Sign in with Apple unavailable with free accounts; backend keys not configured (runs on-device)`
- launched_on_device: `no — not installed on an iPhone in this session`

## ما لم يُختبر هنا (يحتاج أجهزة أو حسابات حقيقية)

- تشغيل التطبيق على آيفون/أندرويد حقيقي (كاميرا، ميكروفون، اهتزاز، Liquid Glass على iOS 26).
- دقة التعرّف الصوتي للهجات (صوت حقيقي من متحدثين من كل منطقة).
- جودة تعرّف Claude الفعلية على صور حقيقية (الاختبارات استخدمت خادماً محاكياً للتحقق من مسار الكود فقط).
- الشراء الفعلي داخل التطبيق (يحتاج منتجات في App Store Connect وGoogle Play وحساب RevenueCat).
- تسجيل الدخول بـ Apple وGoogle (يحتاج معرفات التطبيق والمفاتيح)، وإرسال SMS حقيقي (يحتاج مزوّد SMS).
- IPA موقّع للمتجر/TestFlight — يحتاج حساب Apple Developer؛ انظر docs/BUILD.md.
