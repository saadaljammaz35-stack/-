// App-wide side effects: notification routing and rescheduling, the background refresh
// task, bundled hadith import, location refresh and widget updates.
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { distanceKm } from '@/lib/geo';
import type { PlaceLocation } from '@/lib/prayer-times';
import { TRAVEL_KM } from '@/lib/travel';
import { useSettings } from '@/store/settings';
import { useKhatmaStore } from '@/store/user';

import { ensureBundledBooks } from './hadith/books';
import { syncLiveCountdown } from './live-countdown';
import { locateDevice } from './location';
import { syncMosqueSilent } from './mosque-silent';
import { notifyWeather } from './weather';
import { handlePrayerAction, notificationsSupported, registerPrayerActions, rescheduleNotifications, setupNotificationChannels } from './notifications';
import { loadSession, syncAvailable, syncNow, useSync } from './sync';
import { refreshWidgets } from './widgets/update';

const REFRESH_TASK = 'maallah-refresh';
/** Android runs this for a «صلّيت» button pressed while the app is in the background or closed. */
const NOTIFICATION_TASK = 'maallah-notification-action';
/** Heavier start-up work waits until the launch animation has finished and the first screen is up. */
const AFTER_LAUNCH_MS = 1500;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(REFRESH_TASK, async () => {
    try {
      await rescheduleNotifications({ force: true });
      await refreshWidgets();
      await syncLiveCountdown();
      await syncMosqueSilent();
      await notifyWeather();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
    if (data && 'actionIdentifier' in data) handlePrayerAction(data);
  });

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Leaving home (beyond travel distance) or coming back: the dua of travel or of return. */
async function noticeJourney(from: PlaceLocation, to: PlaceLocation) {
  const { home, language } = useSettings.getState();
  if (!home || !notificationsSupported) return;
  const wasAway = distanceKm(home.lat, home.lng, from.lat, from.lng) >= TRAVEL_KM;
  const isAway = distanceKm(home.lat, home.lng, to.lat, to.lng) >= TRAVEL_KM;
  if (wasAway === isAway) return;
  const ar = language !== 'en';
  await Notifications.scheduleNotificationAsync({
    content: isAway
      ? { title: ar ? `في سفر إلى ${to.name}؟` : `Travelling to ${to.name}?`, body: ar ? 'دعاء السفر، وأحكام القصر والجمع' : 'The dua of travel, shortening and combining', sound: 'default', data: { route: '/adhkar/situation:travel' } }
      : { title: ar ? `حمدًا لله على السلامة` : 'Welcome home', body: ar ? 'ذكر الرجوع من السفر' : 'The dhikr on returning', sound: 'default', data: { route: '/adhkar/hisn:105' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'adhkar' },
  });
}

function openRoute(data: unknown) {
  const route = (data as { route?: string } | undefined)?.route;
  if (typeof route === 'string' && route.startsWith('/')) router.push(route as never);
}

export function AppServices() {
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const notifications = useSettings((s) => s.notifications);
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const language = useSettings((s) => s.language);
  const liveCountdown = useSettings((s) => s.liveCountdown);
  const mosqueSilent = useSettings((s) => s.mosqueSilent);
  const iqama = useSettings((s) => s.iqama);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // One-time setup.
  useEffect(() => {
    const later = setTimeout(() => {
      ensureBundledBooks().catch(() => undefined);
      if (syncAvailable) loadSession().then(syncNow).catch(() => undefined);
      if (!notificationsSupported) return;
      setupNotificationChannels().catch(() => undefined);
      registerPrayerActions().catch(() => undefined);
      if (Platform.OS === 'android') Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => undefined);
      BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 }).catch(() => undefined);
    }, AFTER_LAUNCH_MS);
    if (!notificationsSupported) return () => clearTimeout(later);
    const respond = (r: Notifications.NotificationResponse) => (handlePrayerAction(r) ? router.push('/prayer-log') : openRoute(r.notification.request.content.data));
    const last = Notifications.getLastNotificationResponse();
    if (last) respond(last);
    const sub = Notifications.addNotificationResponseReceivedListener(respond);
    return () => {
      clearTimeout(later);
      sub.remove();
    };
  }, []);

  // Keep GPS-based locations fresh when the user travels.
  useEffect(() => {
    const check = async () => {
      const current = useSettings.getState().location;
      if (!current || current.source !== 'gps') return;
      const res = await locateDevice(false);
      if (res.ok && distanceKm(current.lat, current.lng, res.place.lat, res.place.lng) > 5) {
        noticeJourney(current, res.place).catch(() => undefined);
        useSettings.getState().set({ location: res.place });
      }
    };
    const later = setTimeout(() => check().catch(() => undefined), AFTER_LAUNCH_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        check().catch(() => undefined);
        const { session, lastSync } = useSync.getState();
        if (session && (!lastSync || Date.now() - lastSync > 10 * 60_000)) syncNow().catch(() => undefined);
        rescheduleNotifications().catch(() => undefined);
        refreshWidgets().catch(() => undefined);
        syncLiveCountdown().catch(() => undefined);
        syncMosqueSilent().catch(() => undefined);
      }
    });
    return () => {
      clearTimeout(later);
      sub.remove();
    };
  }, []);

  // Reschedule whenever anything that affects the schedule changes (debounced).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        rescheduleNotifications().catch(() => undefined);
        refreshWidgets().catch(() => undefined);
        syncLiveCountdown().catch(() => undefined);
        syncMosqueSilent().catch(() => undefined);
      },
      firstRun.current ? AFTER_LAUNCH_MS + 300 : 800,
    );
    firstRun.current = false;
  }, [location, prayer, notifications, khatmas, language, liveCountdown, mosqueSilent, iqama]);

  // The first place the user sets is home; travel is noticed against it.
  useEffect(() => {
    if (location && !useSettings.getState().home) useSettings.getState().set({ home: location });
  }, [location]);

  return null;
}
