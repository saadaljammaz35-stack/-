// Adhan sounds for the preview in notification settings. Android previews the full adhan its
// notifications play; iOS (which cannot play Ogg) previews the clip its notifications use.
import { Platform } from 'react-native';

import type { AdhanSound } from '@/lib/notification-plan';

export const ADHAN_PREVIEW: Partial<Record<AdhanSound, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- .ogg is missing from the lint config's asset list
  adhan: Platform.OS === 'android' ? require('../../assets/sounds/adhan_full.ogg') : require('../../assets/sounds/adhan.wav'),
  takbir: require('../../assets/sounds/takbir.wav'),
};
