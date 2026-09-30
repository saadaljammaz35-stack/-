import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { addDays, formatShortDate, startOfDay } from '../domain/dates';
import { deadlinesFor, type DeadlineKind } from '../domain/deadlines';
import type { Receipt } from '../domain/receipt';
import { replaceReminders } from '../db/receipts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * How far ahead of each window to warn. Refund and exchange windows are days
 * long, so one nudge with enough time to drive to the shop is the most useful
 * thing; a warranty gets a month's notice and a final week.
 */
const LEAD_DAYS: Record<DeadlineKind, number[]> = {
  exchange: [1],
  return: [3, 1],
  warranty: [30, 7],
};

/** Reminders fire mid-morning, not at midnight. */
const FIRE_HOUR = 10;

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('deadlines', {
    name: 'مهل الضمان والاسترجاع',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function messageFor(kind: DeadlineKind, receipt: Receipt, daysAhead: number, endsOn: Date) {
  const subject = receipt.item.trim() || receipt.merchant.trim() || 'مشترياتك';
  const when = daysAhead === 1 ? 'غدًا' : `بعد ${daysAhead} أيام`;

  switch (kind) {
    case 'exchange':
      return {
        title: `ينتهي الاستبدال ${when}`,
        body: `${subject} — من ${receipt.merchant}. آخر يوم ${formatShortDate(endsOn)}.`,
      };
    case 'return':
      return {
        title: `ينتهي الاسترجاع ${when}`,
        body: `${subject} — من ${receipt.merchant}. آخر يوم ${formatShortDate(endsOn)}.`,
      };
    case 'warranty':
      return {
        title: daysAhead >= 30 ? 'باقي شهر على انتهاء الضمان' : `ينتهي الضمان ${when}`,
        body: `${subject} — من ${receipt.merchant}. ينتهي ${formatShortDate(endsOn)}. لو فيه أي خلل، الآن وقت المطالبة.`,
      };
  }
}

/**
 * Cancels this receipt's previous alerts and schedules fresh ones. Called after
 * every save, because changing the purchase date moves every window with it.
 */
export async function rescheduleReceipt(receipt: Receipt, enabled: boolean): Promise<void> {
  await cancelReceipt(receipt.id);
  if (!enabled) return;
  if (!(await ensurePermission())) return;

  const now = new Date();
  const scheduled: { kind: string; firesAt: string; notificationId: string }[] = [];

  for (const deadline of deadlinesFor(receipt, now)) {
    if (!deadline.endsOn || deadline.state === 'expired' || deadline.state === 'notApplicable') continue;

    for (const lead of LEAD_DAYS[deadline.kind]) {
      const fireDate = addDays(deadline.endsOn, -lead);
      fireDate.setHours(FIRE_HOUR, 0, 0, 0);

      // A lead time already in the past would fire immediately — skip it.
      if (fireDate.getTime() <= now.getTime()) continue;

      const message = messageFor(deadline.kind, receipt, lead, deadline.endsOn);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { ...message, data: { receiptId: receipt.id, kind: deadline.kind }, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate, channelId: 'deadlines' },
      });

      scheduled.push({
        kind: `${deadline.kind}-${lead}`,
        firesAt: startOfDay(fireDate).toISOString(),
        notificationId,
      });
    }
  }

  await replaceReminders(receipt.id, scheduled);
}

export async function cancelReceipt(receiptId: string): Promise<void> {
  const { remindersFor } = await import('../db/receipts');
  for (const reminder of await remindersFor(receiptId)) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {
      // Already delivered or cleared by the system — nothing left to cancel.
    });
  }
  await replaceReminders(receiptId, []);
}

/** Drops every pending alert, for the notifications-off switch. */
export async function cancelEverything(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function pendingCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
