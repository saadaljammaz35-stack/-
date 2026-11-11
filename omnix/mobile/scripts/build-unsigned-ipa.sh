#!/usr/bin/env bash
# Builds an UNSIGNED OMNIX.ipa on macOS with Xcode. No Apple account is
# needed to build it. To install on an iPhone it must be signed, e.g. with
# Sideloadly or AltStore using your own (free) Apple ID — see ../README.md.
#
#   bash scripts/build-unsigned-ipa.sh        → ./OMNIX-unsigned.ipa
set -euo pipefail
cd "$(dirname "$0")/.."
command -v xcodebuild >/dev/null || { echo "Run this on macOS with Xcode installed."; exit 1; }
npm ci --no-audit --no-fund
npx expo prebuild --platform ios --clean          # generates ios/ and runs pod install
cd ios
xcodebuild \
  -workspace OMNIX.xcworkspace -scheme OMNIX -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath build/OMNIX.xcarchive archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  | tee build/xcodebuild.log | grep -E "error:|warning: .*deprecated|\*\* ARCHIVE" || true
APP=build/OMNIX.xcarchive/Products/Applications/OMNIX.app
[ -d "$APP" ] || { echo "Archive failed — see ios/build/xcodebuild.log"; exit 1; }
rm -rf build/Payload && mkdir -p build/Payload && cp -R "$APP" build/Payload/
(cd build && rm -f ../../OMNIX-unsigned.ipa && zip -qry ../../OMNIX-unsigned.ipa Payload)
cd ..
echo "Built: $(pwd)/OMNIX-unsigned.ipa ($(du -h OMNIX-unsigned.ipa | cut -f1))"
