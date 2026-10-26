// Props passed from the app to the home-screen widgets. Plain JSON only (no Date objects).

export type WidgetStyle = 'green' | 'cream' | 'dark';

export type WidgetPrayer = { name: string; time: string; at: number };

export type PrayerWidgetProps = {
  city: string;
  hijri: string;
  weekday: string;
  prayers: WidgetPrayer[];
  nextIndex: number;
  style: WidgetStyle;
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

export type WidgetHandle<P> = {
  updateSnapshot: (props: P) => void;
  updateTimeline: (entries: { date: Date; props: P }[]) => void;
  reload: () => void;
};
