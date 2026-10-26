import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/screen';
import { IconButton, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toHijri } from '@/lib/hijri';
import { computeMonth, SALAH_IDS, type PrayerId } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const COLS: PrayerId[] = ['fajr', 'sunrise', ...SALAH_IDS.slice(1)];

export default function MonthScreen() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const f = useFormat();
  const today = useToday();
  const [ym, setYm] = useState({ year: today.year, month: today.month });
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const days = useMemo(() => (location ? computeMonth(ym.year, ym.month, location, prayer) : []), [ym, location, prayer]);
  const { width } = useWindowDimensions();
  // Fit all six columns on a phone; wider screens get roomier columns.
  const dayW = 78;
  const colW = Math.max(46, Math.floor((Math.min(width, 720) - 32 - dayW) / COLS.length));
  const shift = (d: number) => setYm(({ year, month }) => (month + d < 1 ? { year: year - 1, month: 12 } : month + d > 12 ? { year: year + 1, month: 1 } : { year, month: month + d }));

  return (
    <Screen title={tr('الجدول الشهري', 'Monthly timetable')} subtitle={location?.name}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={isRTL ? ChevronRight : ChevronLeft} label={tr('الشهر السابق', 'Previous month')} onPress={() => shift(-1)} />
        <Txt variant="heading">{`${f.gregorianMonth(ym.month)} ${ym.year}`}</Txt>
        <IconButton icon={isRTL ? ChevronLeft : ChevronRight} label={tr('الشهر التالي', 'Next month')} onPress={() => shift(1)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ backgroundColor: t.colors.surface, borderRadius: 16, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', backgroundColor: t.colors.fill }}>
            <Txt variant="caption" weight="semibold" color="#fff" style={{ width: dayW, paddingVertical: 8, paddingHorizontal: 6 }}>
              {tr('اليوم', 'Day')}
            </Txt>
            {COLS.map((c) => (
              <Txt key={c} variant="label" weight="semibold" color="#fff" numberOfLines={1} style={{ width: colW, paddingVertical: 8, textAlign: 'center' }}>
                {f.prayer(c)}
              </Txt>
            ))}
          </View>
          {days.map((d) => {
            const h = toHijri(d.date, prayer.hijriOffset);
            const isToday = d.date.day === today.day && d.date.month === today.month && d.date.year === today.year;
            return (
              <View key={d.date.day} style={{ flexDirection: 'row', backgroundColor: isToday ? t.colors.primarySoft : d.date.day % 2 ? 'transparent' : t.colors.surfaceAlt }}>
                <View style={{ width: dayW, paddingVertical: 8, paddingHorizontal: 6 }}>
                  <Txt variant="caption" weight="semibold">{`${d.date.day} ${f.gregorianMonth(d.date.month).slice(0, 5)}`}</Txt>
                  <Txt variant="label" muted numberOfLines={1}>{`${h.day} ${f.hijriMonth(h.month)}`}</Txt>
                </View>
                {COLS.map((c) => (
                  <Txt key={c} variant="caption" style={{ width: colW, paddingVertical: 8, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                    {location ? f.time(d.times[c], location.timezone, true) : ''}
                  </Txt>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
