// App-wide side effects: notification routing and rescheduling, the background refresh
// task, bundled hadith import, location refresh and widget updates.
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { distanceKm } from '@/lib/geo';
import { useSettings } from '@/store/settings';
import { useKhatmaStore } from '@/store/user';

import { ensureBundledBooks } from './hadith/books';
import { locateDevice } from './location';
import { notificationsSupported, rescheduleNotifications, setupNotificationChannels } from './notifications';
import { loadSession, syncAvailable, syncNow, useSync } from './sync';
import { refreshWidgets } from './widgets/update';

const REFRESH_TASK = 'maallah-refresh';
/** Heavier start-up work waits until the launch animation has finished and the first screen is up. */
const AFTER_LAUNCH_MS = 1500;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(REFRESH_TASK, async () => {
    try {
      await rescheduleNotifications({ force: true });
      await refreshWidgets();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // One-time setup.
  useEffect(() => {
    const later = setTimeout(() => {
      ensureBundledBooks().catch(() => undefined);
      if (syncAvailable) loadSession().then(syncNow).catch(() => undefined);
      if (!notificationsSupported) return;
      setupNotificationChannels().catch(() => undefined);
      BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 6 * 60 }).catch(() => undefined);
    }, AFTER_LAUNCH_MS);
    if (!notificationsSupported) return () => clearTimeout(later);
    const last = Notifications.getLastNotificationResponse();
    if (last) openRoute(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openRoute(r.notification.request.content.data));
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
      },
      firstRun.current ? AFTER_LAUNCH_MS + 300 : 800,
    );
    firstRun.current = false;
  }, [location, prayer, notifications, khatmas, language]);

  return null;
}
