<div dir="rtl">

# البناء والنشر — iOS (IPA) وأندرويد (APK/AAB)

## ما تحتاجه (لا يمكن إنشاؤه نيابةً عنك)

| الحاجة | لماذا | التكلفة |
|---|---|---|
| حساب **Apple Developer** (فرد أو منشأة) | توقيع IPA، Sign in with Apple، الشراء داخل التطبيق، TestFlight | 99$ سنوياً |
| حساب **Expo** | EAS Build في السحابة (لا يحتاج جهاز Mac) | الخطة المجانية تكفي للبداية |
| حساب **Google Play Console** | نشر AAB | 25$ مرة واحدة |
| مشروع **Supabase** | الحسابات والمزامنة والدوال | مجاني للتجربة، Pro 25$ شهرياً للإنتاج |
| حساب **RevenueCat** + منتجات في المتجرين | الشراء مرة واحدة واختبار الأسعار | مجاني حتى 2,500$ إيراد شهري |
| مفتاح **Anthropic API** | التعرّف الذكي (يُخزن سراً في Supabase فقط) | حسب الاستخدام — انظر COST-MODEL |
| مزوّد **SMS** | رمز الدخول بالجوال | حسب الرسائل |

## 1) ربط المشروع بـ EAS

```bash
cd MAHALLAK
npx eas-cli@latest login
npx eas-cli@latest init            # ينشئ المشروع ويعطيك projectId
```

ضع `projectId` في متغير `EAS_PROJECT_ID` (يقرؤه `app.config.ts`)، أو أضفه إلى `app.json` تحت `expo.extra.eas.projectId`.

متغيرات البيئة العامة لكل بيئة (لا تضع أسراراً هنا):

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
# وكذلك: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
#         EXPO_PUBLIC_REVENUECAT_IOS_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, EXPO_PUBLIC_PRIVACY_POLICY_URL
# كرّرها لبيئتي preview وdevelopment
```

## 2) iOS — ملف IPA حقيقي

الإعدادات الجاهزة في المشروع:

- Bundle Identifier: ‏`com.mahallak.app` (غيّره في `app.json` إن أردت قبل أول بناء).
- `ios.usesAppleSignIn: true` → يضيف صلاحية Sign in with Apple؛ EAS يفعّل الـ Capability في حسابك تلقائياً.
- رسائل الأذونات بالعربية والإنجليزية (الكاميرا، الميكروفون، التعرّف على الكلام، الصور).
- أيقونة iOS 26 بصيغة Icon Composer ‏(`assets/mahallak.icon`) + شاشة بداية فاتحة/داكنة.
- Privacy Manifest في `app.json`.

### بناء للاختبار على أجهزة محددة (Ad Hoc)

```bash
npx eas-cli device:create                 # سجّل أجهزة المختبرين (رابط يُفتح على الآيفون)
npx eas-cli build -p ios --profile preview
```

EAS يطلب تسجيل الدخول بحساب Apple ويُنشئ **Distribution Certificate** و**Ad Hoc Provisioning Profile** ويحفظهما بأمان. الناتج رابط لتحميل `MAHALLAK.ipa` يُثبَّت مباشرة على الأجهزة المسجلة.

### بناء للمتجر وTestFlight

```bash
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --latest        # يرفع إلى App Store Connect / TestFlight
```

قبل الإرسال في App Store Connect:

1. أنشئ التطبيق بنفس Bundle ID، واملأ `submit.production.ios.ascAppId` في `eas.json`.
2. أنشئ منتج شراء **Non-Consumable** بالمعرّف `mahallak_full_lifetime`.
3. املأ «خصوصية التطبيق» حسب [PRIVACY.md](PRIVACY.md).

### IPA غير موقّع للتثبيت الجانبي (بدون حساب Apple مدفوع)

المشروع مربوط بحساب Expo ‏`@saadaljgaded/mahallak`، والملف `.eas/build/unsigned-ios.yml` يبني التطبيق على Mac سحابي بدون توقيع ويغلّفه `MAHALLAK.ipa`:

```bash
EAS_NO_VCS=1 EAS_PROJECT_ROOT="$PWD" npx eas-cli build -p ios --profile unsigned-ios
```

> `EAS_PROJECT_ROOT` ضروري لأن المشروع داخل مستودع أكبر: بدونه يرفع EAS المستودع كاملاً ويطبّق ‎.gitignore‎ الخاص بالمستودع الأم.

التثبيت: افتح **Sideloadly** (ويندوز/ماك) أو **AltStore**، صِل الآيفون، اختر `MAHALLAK.ipa` وسجّل بحساب Apple العادي. حدود هذا الطريق: التوقيع بحساب مجاني ينتهي بعد 7 أيام (أعد التثبيت)، و«تسجيل الدخول بـ Apple» لا يعمل لأن الحسابات المجانية لا تملك هذه الصلاحية؛ باقي التطبيق يعمل.

### بناء للمحاكي (اختياري)

```bash
npx eas-cli build -p ios --profile development-simulator
```

## 3) أندرويد

```bash
npx eas-cli build -p android --profile preview      # APK للاختبار
npx eas-cli build -p android --profile production   # AAB لمتجر Google Play (توقيع الرفع يديره EAS)
npx eas-cli submit -p android --latest              # المسار الداخلي كمسودة
```

### بناء محلي بدون EAS (ما استُخدم لإنتاج APK الاختبار)

```bash
npx expo prebuild -p android --clean
cd android
ANDROID_HOME=/path/to/android-sdk ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# الناتج: android/app/build/outputs/apk/release/app-release.apk
```

> نسخة الإصدار المحلية موقّعة بمفتاح التصحيح (debug keystore): مناسبة للتثبيت والاختبار فقط، وليست للنشر. للنشر استخدم ملف AAB من EAS.
> متطلبات: JDK 17+، Android SDK 37، build-tools 37.0.0، NDK 27.1.12297006.

## 4) الشراء داخل التطبيق (RevenueCat)

1. أنشئ مشروعاً وأضف تطبيقي iOS وأندرويد، وانسخ المفاتيح العامة إلى `EXPO_PUBLIC_REVENUECAT_*`.
2. Entitlement باسم `full_access` مرتبط بمنتج `mahallak_full_lifetime` في المتجرين.
3. ثلاثة Offerings: `lifetime_19`، `lifetime_29`، `lifetime_39` (كل منها بباقة Lifetime بسعرها)، واجعل `lifetime_29` الحالي.
4. لاختبار الأسعار: RevenueCat → Experiments بين العروض الثلاثة.
5. Webhook → دالة `revenuecat-webhook` (انظر README).

## 5) التحقق قبل الإرسال

```bash
npm run typecheck && npm run test:ci && npx expo-doctor
```

</div>
