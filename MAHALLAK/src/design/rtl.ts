import { I18nManager, Platform } from 'react-native';

/** Layout direction. Native uses I18nManager; web follows the document's dir attribute. */
export function isRTL(): boolean {
  if (Platform.OS === 'web') return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  return I18nManager.isRTL;
}

/** Text alignment that follows the reading direction on every platform. */
export const textStart = Platform.OS === 'web' ? ('start' as 'left') : ('left' as const);
export const textEnd = Platform.OS === 'web' ? ('end' as 'right') : ('right' as const);
