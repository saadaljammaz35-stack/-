import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values that differ per environment and must not be
 * hard-coded: the EAS project id and the Google Sign-In iOS URL scheme.
 * Without them the app still builds; Google Sign-In stays disabled.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (googleScheme?.startsWith('com.googleusercontent.apps.')) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]);
  }
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...(config as ExpoConfig),
    plugins,
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  };
};
