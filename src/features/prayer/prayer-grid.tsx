import { Bell, BellOff, Moon, MoonStar, Sparkles, Sun, SunMedium, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { type DayTimes, type NextPrayer, type PrayerId } from '@/lib/prayer-times';
import { formatCountdown } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

type TileId = PrayerId | 'midnight';
const ICONS: Record<TileId, LucideIcon> = {
  fajr: Sparkles,
  sunrise: Sunrise,
  dhuhr: Sun,
  asr: SunMedium,
  maghrib: Sunset,
  isha: MoonStar,
  midnight: Moon,
};
const ORDER: TileId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];

export function PrayerGrid({ day, next, now, showBells }: { day: DayTimes; next: NextPrayer; now: Date; showBells?: boolean }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [width, setWidth] = useState(0);
  const f = useFormat();
  const tz = useSettings((s) => s.location?.timezone ?? 'UTC');
  const digits = useSettings((s) => s.digits);
  const notif = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);
  const gap = 10;
  const unit = width > 0 ? (width - gap * 3) / 4 : 0;
  // The next prayer is highlighted only when it belongs to the day shown.
  const nextId: TileId | null = next.day.date.day === day.date.day ? next.id : null;

  const toggleBell = (id: PrayerId) => {
    if (id === 'sunrise') return;
    const current = notif.prayers[id];
    setNotifications({ prayers: { ...notif.prayers, [id]: { ...current, enabled: !current.enabled } } });
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {unit > 0 &&
        ORDER.map((id) => {
          const Icon = ICONS[id];
          const at = id === 'midnight' ? day.midnight : day.times[id];
          const label = id === 'midnight' ? tr('منتصف الليل', 'Midnight') : f.prayer(id, day.isFriday);
          const isNext = id === nextId;
          const time = f.time(at, tz);
          const bell =
            showBells && id !== 'midnight' && id !== 'sunrise' ? (
              <Pressable hitSlop={8} onPress={() => toggleBell(id)} accessibilityLabel={tr('تنبيه', 'Alert')}>
                {notif.prayers[id].enabled ? (
                  <Bell size={18} color={isNext ? t.colors.highlight : t.colors.primaryDeep} fill={isNext ? t.colors.highlight : t.colors.primaryDeep} />
                ) : (
                  <BellOff size={18} color={t.colors.textFaint} />
                )}
              </Pressable>
            ) : null;
          if (isNext) {
            return (
              <View
                key={id}
                style={{ width: unit * 2 + gap, minHeight: 116, borderRadius: 18, backgroundColor: t.colors.fill, padding: 14, justifyContent: 'space-between', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon size={18} color={t.colors.highlight} strokeWidth={1.6} />
                  <Txt weight="semibold" color="#FFFFFF">
                    {label}
                  </Txt>
                  <Txt variant="caption" color="rgba(255,255,255,0.8)" style={{ flex: 1 }} numberOfLines={1}>
                    {time}
                  </Txt>
                  {bell}
                </View>
                <View>
                  <Txt variant="label" color="rgba(255,255,255,0.85)">
                    {tr('تبقى على الأذان', 'Until adhan')}
                  </Txt>
                  <Txt weight="semibold" color={t.colors.highlight} numberOfLines={1} style={{ fontSize: t.fs(Math.min(28, unit * 0.32)), lineHeight: t.fs(Math.min(28, unit * 0.32)) * 1.3, fontVariant: ['tabular-nums'] }}>
                    {formatCountdown(next.at.getTime() - now.getTime(), digits)}
                  </Txt>
                </View>
              </View>
            );
          }
          return (
            <View
              key={id}
              style={{ width: unit, minHeight: 116, borderRadius: 18, backgroundColor: t.colors.surface, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon size={18} color={t.colors.textMuted} strokeWidth={1.6} />
              <Txt variant="caption" muted numberOfLines={1}>
                {label}
              </Txt>
              <Txt weight="semibold" color={t.colors.primaryDeep} numberOfLines={1} adjustsFontSizeToFit>
                {time}
              </Txt>
              {bell}
            </View>
          );
        })}
    </View>
  );
}
