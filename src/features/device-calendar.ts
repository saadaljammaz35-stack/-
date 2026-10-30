// The phone's calendar: prayer times and virtuous days written into a calendar of the app's own
// («مع الله», replaced on every export), and the user's appointments read to find those that
// cover a prayer. Nothing leaves the device.
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { prayerConflicts, type CalendarItem, type Conflict } from '@/lib/calendar-conflicts';
import { addCivilDays, type CivilDate } from '@/lib/hijri';
import { computeDay, prayerLabel, SALAH_IDS, type DayTimes } from '@/lib/prayer-times';
import { SEASONS, upcomingOccasions, VIRTUES, type VirtueId } from '@/lib/virtues';
import { useSettings } from '@/store/settings';

export const calendarSupported = Platform.OS === 'ios' || Platform.OS === 'android';

const TITLE = 'مع الله';
const COLOR = '#5A6E51';
/** Weekly days would fill the calendar; the rest are marked. */
const MARKED: VirtueId[] = ['white-days', 'arafah', 'tasua', 'ashura'];
const PRAYER_MINUTES = 20;

export async function requestAccess(): Promise<boolean> {
  const r = await Calendar.requestCalendarPermissions();
  return r.granted;
}

async function ownCalendar(): Promise<Calendar.ExpoCalendar | null> {
  const id = useSettings.getState().deviceCalendarId;
  if (!id) return null;
  try {
    return await Calendar.ExpoCalendar.get(id);
  } catch {
    return null;
  }
}

async function createOwnCalendar(): Promise<Calendar.ExpoCalendar> {
  const details: Parameters<typeof Calendar.createCalendar>[0] =
    Platform.OS === 'ios'
      ? (() => {
          const source = Calendar.getDefaultCalendarSync().source;
          return { title: TITLE, color: COLOR, entityType: Calendar.EntityTypes.EVENT, sourceId: source.id, source };
        })()
      : { title: TITLE, color: COLOR, name: 'maallah', source: { isLocalAccount: true, name: TITLE, type: Calendar.SourceType.LOCAL }, ownerAccount: 'personal', accessLevel: Calendar.CalendarAccessLevel.OWNER };
  const cal = await Calendar.createCalendar(details);
  useSettings.getState().set({ deviceCalendarId: cal.id });
  return cal;
}

export async function removeExport(): Promise<void> {
  const cal = await ownCalendar();
  if (cal) await cal.delete();
  useSettings.getState().set({ deviceCalendarId: null });
}

export async function hasExport(): Promise<boolean> {
  return (await ownCalendar()) != null;
}

function days(from: CivilDate, count: number): DayTimes[] {
  const { location, prayer } = useSettings.getState();
  if (!location) return [];
  return Array.from({ length: count }, (_, i) => computeDay(addCivilDays(from, i), location, prayer));
}

/** All-day events need the local midnight on iOS and the UTC midnight on Android. */
function allDay(d: CivilDate) {
  return Platform.OS === 'ios'
    ? { startDate: new Date(d.year, d.month - 1, d.day), endDate: new Date(d.year, d.month - 1, d.day, 23, 59) }
    : { startDate: new Date(Date.UTC(d.year, d.month - 1, d.day)), endDate: new Date(Date.UTC(d.year, d.month - 1, d.day + 1)), timeZone: 'UTC' };
}

/** Replaces the app's calendar with the prayer times (and virtuous days) of the coming days. */
export async function exportToCalendar(opts: { from: CivilDate; days: number; virtues: boolean; lang: 'ar' | 'en' }): Promise<number> {
  const { location, prayer } = useSettings.getState();
  if (!location) throw new Error('no location');
  const old = await ownCalendar();
  if (old) await old.delete();
  const cal = await createOwnCalendar();
  const note = opts.lang === 'ar' ? 'من تطبيق «مع الله» — حسب طريقة الحساب المختارة فيه.' : 'From the «Ma Allah» app — by its chosen calculation method.';
  let n = 0;
  for (const day of days(opts.from, opts.days)) {
    for (const id of SALAH_IDS) {
      const at = day.times[id];
      await cal.createEvent({
        title: prayerLabel(id, day.isFriday, opts.lang),
        startDate: at,
        endDate: new Date(at.getTime() + PRAYER_MINUTES * 60_000),
        timeZone: location.timezone,
        notes: note,
        alarms: [],
      });
      n++;
    }
  }
  if (opts.virtues) {
    for (const o of upcomingOccasions(opts.from, opts.days, prayer.hijriOffset)) {
      const titles = [...o.virtues.filter((v) => MARKED.includes(v)).map((v) => VIRTUES[v].title[opts.lang]), ...(o.seasonStarts ? [SEASONS[o.seasonStarts].title[opts.lang]] : [])];
      if (!titles.length) continue;
      await cal.createEvent({ title: titles.join(' — '), allDay: true, ...allDay(o.date), notes: note, alarms: [] });
      n++;
    }
  }
  return n;
}

/** Appointments in the user's other calendars that cover a prayer in the coming days. */
export async function upcomingConflicts(from: CivilDate, count = 7): Promise<Conflict[]> {
  const own = useSettings.getState().deviceCalendarId;
  const calendars = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter((c) => c.id !== own);
  if (!calendars.length) return [];
  const range = days(from, count);
  if (!range.length) return [];
  const start = new Date();
  const end = new Date(range[range.length - 1].times.isha.getTime() + 3_600_000);
  const events = await Calendar.listEvents(calendars, start, end);
  const items: CalendarItem[] = events.map((e) => ({ id: e.id, title: e.title || '—', start: new Date(e.startDate), end: new Date(e.endDate), allDay: e.allDay }));
  return prayerConflicts(items, range).filter((c) => c.at >= start);
}
