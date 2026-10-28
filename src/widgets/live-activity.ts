// Live Activities exist only on iOS (live-activity.ios.tsx); Android uses an ongoing notification.
import type { LiveActivityHandle, PrayerActivityProps } from './types';

export const PrayerActivity: LiveActivityHandle<PrayerActivityProps> | null = null;
