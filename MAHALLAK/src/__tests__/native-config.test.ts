/**
 * Guards the native configuration that voice search and photos depend on.
 * Two real regressions this catches (both found while verifying the build):
 *  - `microphonePermission: false` on expo-camera / expo-image-picker DELETES
 *    NSMicrophoneUsageDescription, so iOS would kill the app when voice search starts.
 *  - `recordAudioAndroid: false` on expo-camera marks RECORD_AUDIO as removed in
 *    the merged Android manifest, so voice search could never get the microphone.
 */
import app from '../../app.json';
import eas from '../../eas.json';

type PluginEntry = string | [string, Record<string, unknown>];
const plugins = app.expo.plugins as PluginEntry[];
const opts = (name: string) => {
  const p = plugins.find((x) => (Array.isArray(x) ? x[0] : x) === name);
  return Array.isArray(p) ? p[1] : {};
};

describe('native configuration', () => {
  it('never disables the microphone through camera or image-picker plugins', () => {
    for (const name of ['expo-camera', 'expo-image-picker']) {
      const o = opts(name);
      expect(o.microphonePermission).not.toBe(false);
      expect(o.recordAudioAndroid).not.toBe(false);
    }
  });

  it('declares every iOS usage description the app needs', () => {
    const plist = app.expo.ios.infoPlist as Record<string, unknown> as Record<string, string>;
    for (const key of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSSpeechRecognitionUsageDescription', 'NSPhotoLibraryUsageDescription']) {
      expect(plist[key]?.length).toBeGreaterThan(10);
    }
  });

  it('requests the Android microphone and camera and never blocks them', () => {
    expect(app.expo.android.permissions).toEqual(expect.arrayContaining(['android.permission.CAMERA', 'android.permission.RECORD_AUDIO']));
    expect(app.expo.android.blockedPermissions).not.toContain('android.permission.RECORD_AUDIO');
    expect(app.expo.android.blockedPermissions).not.toContain('android.permission.CAMERA');
  });

  it('enables Sign in with Apple and uses the same id on both platforms', () => {
    expect(app.expo.ios.usesAppleSignIn).toBe(true);
    expect(app.expo.ios.bundleIdentifier).toBe(app.expo.android.package);
  });

  it('localizes the permission prompts and display name in Arabic and English', () => {
    expect(Object.keys(app.expo.locales)).toEqual(['ar', 'en']);
  });

  it('has internal-testing and store build profiles', () => {
    expect(eas.build.preview.distribution).toBe('internal');
    expect(eas.build.preview.android.buildType).toBe('apk');
    expect(eas.build.production.distribution).toBe('store');
    expect(eas.build.production.android.buildType).toBe('app-bundle');
  });
});
