/**
 * Notification contracts.
 *
 * Delivery is asynchronous by design. A notification is written to the outbox
 * inside the same database transaction as the event that caused it, then
 * relayed after commit — so a slow SMS gateway can never hold a lock on a
 * customer's balance, and a notification can never claim a transfer happened
 * when the transaction was rolled back.
 */

import type { NotificationChannel } from '@nabd/shared';

export type NotificationEvent =
  | 'auth.login'
  | 'auth.login.new_device'
  | 'auth.password_changed'
  | 'auth.pin_changed'
  | 'transfer.sent'
  | 'transfer.received'
  | 'transfer.failed'
  | 'payment.completed'
  | 'payment.failed'
  | 'card.transaction'
  | 'card.frozen'
  | 'beneficiary.added'
  | 'kyc.updated'
  | 'security.alert';

export interface NotificationMessage {
  readonly id: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly event: NotificationEvent;
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, string>>;
  readonly locale: 'ar' | 'en';
}

export interface DeliveryResult {
  readonly delivered: boolean;
  readonly providerMessageId?: string;
  readonly error?: string;
  /** False for a permanent failure — an invalid number, an unsubscribed user. */
  readonly retryable: boolean;
}

/** One implementation per channel. Push, SMS, email and in-app all differ. */
export interface NotificationChannelProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<DeliveryResult>;
}

/**
 * Which events a customer may not switch off.
 *
 * Marketing preferences are the customer's choice; security notifications are
 * not. A customer who has silenced "password changed" cannot be told their
 * account was taken over — so these bypass preferences entirely.
 */
export const MANDATORY_EVENTS: readonly NotificationEvent[] = [
  'auth.login.new_device',
  'auth.password_changed',
  'auth.pin_changed',
  'beneficiary.added',
  'security.alert',
];

export function isMandatory(event: NotificationEvent): boolean {
  return MANDATORY_EVENTS.includes(event);
}

/**
 * Which channels an event should use.
 *
 * Security events go to every channel available: the attacker may control one
 * of them. Someone who has taken over a phone number still does not have the
 * email inbox, and vice versa.
 */
export function channelsFor(event: NotificationEvent): NotificationChannel[] {
  if (isMandatory(event)) return ['PUSH', 'SMS', 'EMAIL', 'IN_APP'];
  if (event.startsWith('transfer.') || event.startsWith('payment.')) {
    return ['PUSH', 'IN_APP'];
  }
  return ['IN_APP'];
}

/**
 * Notification copy must never contain a full amount for a security event, or
 * anything that helps an attacker reading a lock-screen preview confirm what
 * they have access to.
 */
export interface NotificationTemplate {
  readonly ar: { title: string; body: string };
  readonly en: { title: string; body: string };
}

export const templates: Partial<Record<NotificationEvent, NotificationTemplate>> = {
  'auth.login.new_device': {
    ar: {
      title: 'تسجيل دخول من جهاز جديد',
      body: 'تم تسجيل الدخول إلى حسابك من جهاز جديد. إذا لم تكن أنت، أوقف الجلسة فورًا.',
    },
    en: {
      title: 'New device sign-in',
      body: 'Your account was accessed from a new device. If this was not you, end the session now.',
    },
  },
  'beneficiary.added': {
    ar: {
      title: 'تمت إضافة مستفيد',
      body: 'أُضيف مستفيد جديد إلى حسابك. إذا لم تكن أنت، تواصل معنا فورًا.',
    },
    en: {
      title: 'Beneficiary added',
      body: 'A new beneficiary was added to your account. If this was not you, contact us now.',
    },
  },
  'transfer.sent': {
    ar: { title: 'تم إرسال التحويل', body: 'تم تنفيذ تحويلك بنجاح.' },
    en: { title: 'Transfer sent', body: 'Your transfer completed successfully.' },
  },
  'transfer.received': {
    ar: { title: 'وصلك مبلغ', body: 'تم إيداع مبلغ في حسابك.' },
    en: { title: 'Money received', body: 'An amount has been credited to your account.' },
  },
};
