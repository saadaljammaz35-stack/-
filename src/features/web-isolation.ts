// expo-sqlite on web needs a cross-origin isolated page. Chromium and Firefox accept
// `Cross-Origin-Embedder-Policy: credentialless`; Safari (and every iOS browser, which all use
// WebKit) only accepts `require-corp`, under which cross-origin media must be fetched with CORS.
// Keep this pattern in sync with the header rules in vercel.json.
import { Platform } from 'react-native';

export const WEBKIT_UA = /(iPhone|iPad|iPod)|^(?!.*(Chrome|Chromium|CriOS|Edg|Firefox|FxiOS)).*Macintosh/;

/** True when media from other origins must be requested in CORS mode. */
export function mediaNeedsCors(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && WEBKIT_UA.test(navigator.userAgent);
}
