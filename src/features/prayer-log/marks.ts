import { Check, Clock, UsersRound, X, type LucideIcon } from 'lucide-react-native';

import type { PrayerMark } from '@/lib/prayer-log';
import type { Palette } from '@/theme/tokens';

export const MARK_META: Record<PrayerMark, { ar: string; en: string; icon: LucideIcon }> = {
  jamaah: { ar: 'جماعة', en: 'In jamaah', icon: UsersRound },
  ontime: { ar: 'في وقتها', en: 'On time', icon: Check },
  late: { ar: 'متأخرة', en: 'Late', icon: Clock },
  missed: { ar: 'فاتتني', en: 'Missed', icon: X },
};

export function markColor(mark: PrayerMark, c: Palette): string {
  return mark === 'jamaah' ? c.fill : mark === 'ontime' ? c.success : mark === 'late' ? c.warning : c.danger;
}

/** Text on a filled mark: `fill` always takes white; the status colours are light in dark mode. */
export function markInk(mark: PrayerMark, c: Palette): string {
  return mark === 'jamaah' || c.scheme === 'light' ? '#FFFFFF' : '#141A12';
}
