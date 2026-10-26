// Web and test fallback: home-screen widgets exist only on iOS and Android.
import type { DailyWidgetProps, DateWidgetProps, KhatmaWidgetProps, PrayerWidgetProps, WidgetHandle } from './types';

function noop<P>(): WidgetHandle<P> {
  return { updateSnapshot: () => undefined, updateTimeline: () => undefined, reload: () => undefined };
}

export const PrayerWidget = noop<PrayerWidgetProps>();
export const DailyWidget = noop<DailyWidgetProps>();
export const DateWidget = noop<DateWidgetProps>();
export const KhatmaWidget = noop<KhatmaWidgetProps>();
export const widgetsAvailable = false;
export const supportsTimeline = false;
