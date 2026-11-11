# OMNIX for iPhone

A native iOS shell (Expo SDK 58, React Native, WKWebView) around your OMNIX
server: first-run server setup with an `https` health check, the full OMNIX
interface, session kept on the device, file uploads from Files, external
links in Safari, pull-to-refresh, offline screen, light/dark splash with the
OMNIX mark. Bundle id `app.omnix.personal` (change it in `app.json` if you
publish).

It needs a running OMNIX server (see `../AI_MODEL_DEPLOYMENT.md`); the app
asks for its address on first launch.

## Get an .ipa

**Unsigned (no Apple Developer account needed to build):**

```bash
bash scripts/build-unsigned-ipa.sh      # on any Mac with Xcode → OMNIX-unsigned.ipa
```

**Install it on your iPhone** with **Sideloadly** (Windows/macOS) or
**AltStore**, signing with your own Apple ID. With a free Apple ID the app
must be re-signed every 7 days; with a paid Apple Developer account
($99/year) it lasts a year and you can use TestFlight / the App Store.

**Signed, with an Apple Developer account (EAS Build):**

```bash
npx eas-cli login && npx eas-cli init          # links the project to your Expo account
npx eas-cli build --platform ios --profile preview      # internal distribution (.ipa)
npx eas-cli build --platform ios --profile production   # App Store / TestFlight
```

EAS asks for your Apple account once and manages certificates and profiles.

## Verify

```bash
npm install
npm run typecheck        # TypeScript
npm run bundle:ios       # Metro → Hermes iOS bundle
npm run prebuild:ios     # generates the native Xcode project (any OS)
npx expo-doctor          # 20/20 checks
```
