// Signs Android release builds with the app's upload key when one is provided, so a local
// release build can go straight to Google Play. The key never lives in the repository: point
// MAALLAH_UPLOAD_STORE_FILE, MAALLAH_UPLOAD_STORE_PASSWORD, MAALLAH_UPLOAD_KEY_ALIAS and
// MAALLAH_UPLOAD_KEY_PASSWORD at it (environment variables or ~/.gradle/gradle.properties).
// Without them release builds keep Expo's default debug signing; EAS Build signs with its own
// managed credentials and is unaffected.
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// with-release-signing';
const prop = (name) => `(findProperty('${name}') ?: System.getenv('${name}'))`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    const releaseConfig = [
      `signingConfigs {`,
      `        ${MARK}`,
      `        release {`,
      `            def uploadStore = ${prop('MAALLAH_UPLOAD_STORE_FILE')}`,
      `            if (uploadStore) {`,
      `                storeFile file(uploadStore)`,
      `                storePassword ${prop('MAALLAH_UPLOAD_STORE_PASSWORD')}`,
      `                keyAlias ${prop('MAALLAH_UPLOAD_KEY_ALIAS')}`,
      `                keyPassword ${prop('MAALLAH_UPLOAD_KEY_PASSWORD')}`,
      `            }`,
      `        }`,
      ``,
    ].join('\n');
    const withConfig = src.replace(/signingConfigs \{\n/, releaseConfig);
    const withRelease = withConfig.replace(
      /(release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug',
    );
    if (withConfig === src || withRelease === withConfig) {
      throw new Error('with-release-signing: app/build.gradle no longer matches the expected template');
    }
    cfg.modResults.contents = withRelease;
    return cfg;
  });
};
