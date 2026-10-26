// Schedules the rolling window of local notifications computed by lib/notification-plan.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import type { CivilDate } from '@/lib/hijri';
import { schedule as khatmaSchedule } from '@/lib/khatma';
import { normalizeAdhanSound, planNotifications, type AdhanSound, type PlannedNotification } from '@/lib/notification-plan';
import { useSettings } from '@/store/settings';
import { useKhatmaStore } from '@/store/user';

export const notificationsSupported = Platform.OS !== 'web';

// Android channels: a channel's sound cannot change after creation, so each adhan sound
// gets its own channel.
// Sound files are bundled through the expo-notifications plugin (app.json → sounds).
const ADHAN_CHANNELS: Record<AdhanSound, { id: string; name: string; sound: string | null }> = {
  adhan: { id: 'adhan-clip-v2', name: 'الأذان', sound: 'adhan.wav' },
  takbir: { id: 'adhan-takbir-v2', name: 'الأذان (التكبير)', sound: 'takbir.wav' },
  default: { id: 'adhan-default-v1', name: 'تنبيه الأذان', sound: 'default' },
  silent: { id: 'adhan-silent-v1', name: 'الأذان (صامت)', sound: null },
};

/** Channels created by earlier versions, removed so they do not linger in system settings. */
const RETIRED_CHANNELS = ['adhan-makkah-v1', 'adhan-short-v1', 'adhan-takbir-v1'];

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

function channelFor(n: PlannedNotification): string {
  if (n.channel === 'adhan') return ADHAN_CHANNELS[normalizeAdhanSound(n.sound)].id;
  return n.channel;
}

/** iOS plays the sound named in the notification; Android uses the channel's sound. */
function soundFor(n: PlannedNotification): string | false {
  if (n.channel !== 'adhan') return 'default';
  return ADHAN_CHANNELS[normalizeAdhanSound(n.sound)].sound ?? false;
}

function khatmaReminders() {
  return useKhatmaStore
    .getState()
    .khatmas.filter((k) => k.status === 'active' && k.reminder.enabled)
    .map((k) => {
      const plan = khatmaSchedule(k);
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
  const { location, prayer, notifications } = useSettings.getState();
  if (!location) return 0;
  if (!(await ensurePermission(false))) return 0;
  const now = new Date();
  const plan = planNotifications({
    now,
    place: location,
    prayer,
    settings: notifications,
    khatmas: khatmaReminders(),
  });
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
        data: { route: n.route },
        interruptionLevel: n.channel === 'adhan' ? 'timeSensitive' : 'active',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: channelFor(n) },
    });
  }
  lastSignature = signature;
  return plan.length;
}

export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'مع الله', body: 'تعمل التنبيهات بشكل صحيح', sound: 'default', data: { route: '/settings/notifications' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
  });
}

export async function scheduledCount(): Promise<number> {
  if (!notificationsSupported) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

