# Store and release kit

| File | Use |
| --- | --- |
| `listing.md` | Titles, descriptions, keywords (Arabic and English). `node store/check-listing.mjs` checks every length. |
| `privacy-forms.md` | Answers for Google Play Data safety and App Store App Privacy. |
| `screenshots/ios/*.jpg` | 1290×2796, App Store 6.7"/6.9" iPhone. |
| `screenshots/android/*.jpg` | 1080×1920, Google Play phone. |
| `feature-graphic.png` | 1024×500, Google Play feature graphic. |
| `icon-512.png` | 512×512, Google Play hi-res icon. |

## Signing Android releases

Release builds are signed by `plugins/with-release-signing.js` when these are set (environment
variables or `~/.gradle/gradle.properties`); the upload key itself is never committed:

```
MAALLAH_UPLOAD_STORE_FILE=/path/to/ma-allah-upload.jks
MAALLAH_UPLOAD_STORE_PASSWORD=…
MAALLAH_UPLOAD_KEY_ALIAS=ma-allah-upload
MAALLAH_UPLOAD_KEY_PASSWORD=…
```

Then `npx expo prebuild --platform android` and `cd android && ./gradlew bundleRelease`
(AAB for Google Play) or `assembleRelease` (APK to install directly). Without the variables,
release builds fall back to the debug key. EAS Build ignores the plugin and uses its own
managed credentials.

Enrol the app in **Play App Signing** on first upload: Google keeps the app signing key and
this upload key can be reset through Play support if it is ever lost.

## Group khatma links (Android App Links)

`public/.well-known/assetlinks.json` lets `https://ma-allah.vercel.app/group/…` open the app
directly. It lists the upload key's SHA-256. After the first Play upload, add the **app signing
key** SHA-256 from Play Console → Setup → App signing to the same list and redeploy the web app.

## Online service

Group khatmas use the Supabase project `ma-allah` (ref `clggalmsmlkwlwkerchn`, Mumbai), set up
from `supabase/migrations/`. Its URL and publishable key in `app.json → extra.cloud` are public
by design; the tables are closed and only the `gk_*` functions can change them.
Account sync (`extra.cloud.accountSync`) stays off until the project's sign-in email template
sends a 6-digit code.
