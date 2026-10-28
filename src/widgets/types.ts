// Props passed from the app to the home-screen widgets. Plain JSON only (no Date objects).

export type WidgetStyle = 'green' | 'cream' | 'dark';

export type WidgetPrayer = { name: string; time: string; clock: string; at: number };

/** One timeline entry (see lib/widget-timeline) plus what the app adds around it. */
export type PrayerWidgetProps = {
  hijriNumeric: string;
  weekday: string;
  weekdayIndex: number;
  prayers: WidgetPrayer[];
  nextIndex: number;
  next: { name: string; time: string; at: number };
  prev: { name: string; time: string; at: number };
  remainingLabel: string;
  sinceLabel: string;
  city: string;
  lang: 'ar' | 'en';
  /** Lay the prayers out against the device's own direction (Fajr first in reading order). */
  reverse: boolean;
  /** Folder shared with the widget that holds the calligraphic weekday images, if copied. */
  artDir: string | null;
  /** Android cannot count down live; it shows this line instead. */
  nextLine: string;
};

export type DailyWidgetProps = {
  ayah: { text: string; ref: string };
  hadith: { text: string; ref: string };
  dhikr: { text: string; ref: string };
  style: WidgetStyle;
};

export type DateWidgetProps = {
  hijri: string;
  gregorian: string;
  weekday: string;
  note: string;
  style: WidgetStyle;
};

export type KhatmaWidgetProps = {
  name: string;
  percent: number;
  today: string;
  detail: string;
  style: WidgetStyle;
};

/** Initial props of a widget whose content only the app can compute (prayer times, dates). */
export type WidgetPending = { pending: true };

export type WidgetHandle<P> = {
  updateSnapshot: (props: P) => void;
  updateTimeline: (entries: { date: Date; props: P }[]) => void;
  reload: () => void;
};
