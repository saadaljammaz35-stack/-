// The web app schedules no notifications, so it ships no adhan recordings.
import type { AdhanSound } from '@/lib/notification-plan';

export const ADHAN_PREVIEW: Partial<Record<AdhanSound, number>> = {};
