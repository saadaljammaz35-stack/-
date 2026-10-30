// Schedules the rolling window of local notifications computed by lib/notification-plan.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { parseCivilKey, type CivilDate } from '@/lib/hijri';
import type { FardId, PrayerMark } from '@/lib/prayer-log';
import { effectiveSchedule } from '@/lib/khatma';
import { civilDateIn } from '@/lib/time';
import { FAJR_WAKE_REPEATS, fajrWakeId, normalizeAdhanSound, planNotifications, type AdhanSound, type PlannedNotification } from '@/lib/notification-plan';
import { useSettings } from '@/store/settings';
import { useKhatmaStore, usePrayerLogStore } from '@/store/user';

export const notificationsSupported = Platform.OS !== 'web';

// Android channels: a channel's sound cannot change after creation, so each adhan sound
// gets its own channel, and a new recording means new channel ids.
// Sound files are bundled through the expo-notifications plugin (app.json → sounds). Android
// plays the full adhan; iOS caps notification sounds at 30 seconds and plays the opening takbirs.
const ADHAN_CHANNELS: Record<AdhanSound, { id: string; name: string; sound: string | null; iosSound?: string }> = {
  adhan: { id: 'adhan-full-v3', name: 'الأذان كاملًا', sound: 'adhan_full.ogg', iosSound: 'adhan.wav' },
  takbir: { id: 'adhan-takbir-v3', name: 'الأذان (التكبير)', sound: 'takbir.wav' },
  default: { id: 'adhan-default-v1', name: 'تنبيه الأذان', sound: 'default' },
  silent: { id: 'adhan-silent-v1', name: 'الأذان (صامت)', sound: null },
};

/** Channels created by earlier versions, removed so they do not linger in system settings. */
const RETIRED_CHANNELS = ['adhan-makkah-v1', 'adhan-short-v1', 'adhan-takbir-v1', 'adhan-clip-v2', 'adhan-takbir-v2'];

/** Android: silent adhan alerts whose vibration counts the prayer — one pulse for Fajr … five for Isha. */
const VIBRATION_PRAYERS: FardId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const vibrationChannel = (id: FardId) => `adhan-vibrate-${id}-v1`;
function pulses(n: number): number[] {
  const pattern = [0];
  for (let i = 0; i < n; i++) pattern.push(450, 350);
  return pattern;
}

export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
  for (const id of RETIRED_CHANNELS) await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
  for (const c of Object.values(ADHAN_CHANNELS)) {
    await Notifications.setNotificationChannelAsync(c.id, {
      name: c.name,
      importance: AndroidImportance.HIGH,
      sound: c.sound,
      vibrationPattern: c.sound ? [0, 400, 200, 400] : null,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
  }
  for (const [i, id] of VIBRATION_PRAYERS.entries()) {
    await Notifications.setNotificationChannelAsync(vibrationChannel(id), {
      name: `الأذان (اهتزاز ${i + 1})`,
      importance: AndroidImportance.HIGH,
      sound: null,
      vibrationPattern: pulses(i + 1),
      enableVibrate: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'التذكيرات',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('adhkar', {
    name: 'الأذكار',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function ensurePermission(ask: boolean): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return res.granted;
}

const quietVibration = (n: PlannedNotification) => Platform.OS === 'android' && n.channel === 'adhan' && n.prayer != null && useSettings.getState().notifications.quietVibration?.enabled === true;

function channelFor(n: PlannedNotification): string {
  if (quietVibration(n)) return vibrationChannel(n.prayer!);
  if (n.channel === 'adhan') return ADHAN_CHANNELS[normalizeAdhanSound(n.sound)].id;
  return n.channel;
}

/** iOS plays the sound named in the notification; Android uses the channel's sound. */
function soundFor(n: PlannedNotification): string | false {
  if (quietVibration(n)) return false;
  if (n.channel !== 'adhan') return 'default';
  const c = ADHAN_CHANNELS[normalizeAdhanSound(n.sound)];
  return (Platform.OS === 'ios' ? (c.iosSound ?? c.sound) : c.sound) ?? false;
}

function khatmaReminders() {
  return useKhatmaStore
    .getState()
    .khatmas.filter((k) => k.status === 'active' && k.reminder.enabled)
    .map((k) => {
      const tz = useSettings.getState().location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const plan = effectiveSchedule(k, civilDateIn(new Date(), tz));
      return {
        id: k.id,
        name: k.name,
        at: { hour: k.reminder.hour, minute: k.reminder.minute },
        portion: (date: CivilDate) => {
          const p = plan.find((d) => d.date.year === date.year && d.date.month === date.month && d.date.day === date.day);
          // Skip days whose portion is already read.
          return p && p.to > k.progress ? { from: Math.max(p.from, k.progress + 1), to: p.to } : null;
        },
      };
    });
}

let lastSignature = '';

/** Rebuilds every scheduled notification. Safe to call often; skips when nothing changed. */
export async function rescheduleNotifications(opts: { force?: boolean } = {}): Promise<number> {
  if (!notificationsSupported) return 0;
  const { location, prayer, notifications, language } = useSettings.getState();
  if (!location) return 0;
  if (!(await ensurePermission(false))) return 0;
  const now = new Date();
  const plan = planNotifications({
    now,
    place: location,
    prayer,
    settings: notifications,
    khatmas: khatmaReminders(),
    lang: language,
    fajrWokeOn: useSettings.getState().fajrWokeOn,
  });
  const actions = notifications.prayerActions?.enabled !== false;
  const signature = JSON.stringify(plan.map((p) => [p.id, p.at.getTime(), p.title, p.body, p.sound]));
  if (!opts.force && signature === lastSignature) return plan.length;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: n.title,
        body: n.body,
        sound: soundFor(n),
        data: { route: n.route, ...(n.prayer ? { prayer: n.prayer, date: n.date } : {}) },
        interruptionLevel: n.channel === 'adhan' ? 'timeSensitive' : 'active',
        ...(n.prayer && actions ? { categoryIdentifier: PRAYER_CATEGORY } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: channelFor(n) },
    });
  }
  lastSignature = signature;
  return plan.length;
}

export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'مع الله',
      body: useSettings.getState().language === 'en' ? 'Notifications are working' : 'تعمل التنبيهات بشكل صحيح',
      sound: 'default',
      data: { route: '/settings/notifications' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
  });
}

export async function scheduledCount(): Promise<number> {
  if (!notificationsSupported) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

// «صلّيت»: buttons on the adhan alert that log the prayer. On Android they work without opening the
// app (through the background notification task); iOS opens the app to record them.
export const PRAYER_CATEGORY = 'prayer-v1';
const ACTION_MARKS: Record<string, PrayerMark> = { jamaah: 'jamaah', ontime: 'ontime' };

export async function registerPrayerActions(): Promise<void> {
  if (!notificationsSupported) return;
  const en = useSettings.getState().language === 'en';
  const opensAppToForeground = Platform.OS === 'ios';
  await Notifications.setNotificationCategoryAsync(PRAYER_CATEGORY, [
    { identifier: 'jamaah', buttonTitle: en ? 'Prayed in congregation' : 'صلّيت جماعة', options: { opensAppToForeground } },
    { identifier: 'ontime', buttonTitle: en ? 'Prayed' : 'صلّيت', options: { opensAppToForeground } },
  ]);
}

/** Logs the prayer when a «صلّيت» button was pressed. Returns whether the response was such an action. */
export function handlePrayerAction(response: Notifications.NotificationResponse): boolean {
  const mark = ACTION_MARKS[response.actionIdentifier];
  if (!mark) return false;
  const data = response.notification.request.content.data as { prayer?: FardId; date?: string } | undefined;
  if (!data?.prayer || !data.date) return true;
  usePrayerLogStore.getState().mark(parseCivilKey(data.date), data.prayer, mark);
  Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
  return true;
}

/** «منبّه الفجر بالآية» answered: no more repeats today. */
export async function stopFajrWake(dateKey: string): Promise<void> {
  useSettings.getState().set({ fajrWokeOn: dateKey });
  if (!notificationsSupported) return;
  await Promise.all(FAJR_WAKE_REPEATS.map((_, n) => Notifications.cancelScheduledNotificationAsync(fajrWakeId(dateKey, n)).catch(() => undefined)));
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}
