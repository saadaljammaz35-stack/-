// «صامت في المسجد»: on Android, Do Not Disturb (priority only) from just before each chosen
// iqama until the prayer is over, switched by alarms in the native module. Elsewhere, the adhan
// alert can carry a reminder instead.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { mosqueWindows } from '@/lib/mosque-windows';
import { prayerLabel } from '@/lib/prayer-times';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';

type Native = {
  hasAccess: () => boolean;
  openAccessSettings: () => void;
  schedule: (windows: { start: number; end: number; label: string }[], channelName: string, text: string) => void;
  stop: () => void;
};

const Silent = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('MosqueSilent') : null;

export const mosqueSilentSupported = Silent != null;

export function hasSilentAccess(): boolean {
  try {
    return Silent?.hasAccess() ?? false;
  } catch {
    return false;
  }
}

export function openSilentAccess(): void {
  Silent?.openAccessSettings();
}

export async function syncMosqueSilent(): Promise<void> {
  if (!Silent) return;
  const { mosqueSilent, location, prayer, iqama, language } = useSettings.getState();
  if (!mosqueSilent.enabled || !location || !mosqueSilent.prayers.length) {
    Silent.stop();
    return;
  }
  const ar = language !== 'en';
  const now = new Date();
  const windows = mosqueWindows({ today: civilDateIn(now, location.timezone), now, place: location, prayer, iqama, prayers: mosqueSilent.prayers, minutes: mosqueSilent.minutes, days: 3 });
  Silent.schedule(
    windows.map((w) => ({ start: w.start.getTime(), end: w.end.getTime(), label: ar ? `صلاة ${prayerLabel(w.prayer, w.friday, 'ar')}` : `${prayerLabel(w.prayer, w.friday, 'en')} prayer` })),
    ar ? 'صامت في المسجد' : 'Silent at the mosque',
    ar ? 'الجوال على «عدم الإزعاج» حتى %s' : 'Do Not Disturb until %s',
  );
}
