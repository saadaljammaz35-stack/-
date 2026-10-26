import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, IconButton, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, civilWeekday, toGregorian, toHijri, WEEKDAYS } from '@/lib/hijri';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

// Dates fixed by the Sunnah or by the Hajj rites; no disputed commemorations are listed.
const OCCASIONS: Record<string, string> = {
  '1-1': 'بداية العام الهجري',
  '1-10': 'يوم عاشوراء',
  '9-1': 'بداية شهر رمضان',
  '10-1': 'عيد الفطر',
  '12-8': 'يوم التروية',
  '12-9': 'يوم عرفة',
  '12-10': 'عيد الأضحى',
  '12-11': 'أيام التشريق',
  '12-12': 'أيام التشريق',
  '12-13': 'أيام التشريق',
};

export default function CalendarScreen() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const f = useFormat();
  const today = useToday();
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const todayH = toHijri(today, offset);
  const [hm, setHm] = useState({ year: todayH.year, month: todayH.month });

  const cells = useMemo(() => {
    const first = toGregorian({ year: hm.year, month: hm.month, day: 1 }, offset);
    const list: { civil: ReturnType<typeof addCivilDays>; hd: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const civil = addCivilDays(first, i);
      const h = toHijri(civil, offset);
      if (h.month !== hm.month) break;
      list.push({ civil, hd: h.day });
    }
    return { lead: civilWeekday(first), list };
  }, [hm, offset]);

  const shift = (d: number) => setHm(({ year, month }) => (month + d < 1 ? { year: year - 1, month: 12 } : month + d > 12 ? { year: year + 1, month: 1 } : { year, month: month + d }));
  const occasions = cells.list.filter((c) => OCCASIONS[`${hm.month}-${c.hd}`] || (c.hd >= 13 && c.hd <= 15 && hm.month !== 9 && !(hm.month === 12 && c.hd === 13)));
  const first = cells.list[0]?.civil;
  const last = cells.list[cells.list.length - 1]?.civil;

  return (
    <Screen title={tr('التقويم الهجري', 'Hijri calendar')} subtitle={tr('تقويم أم القرى', 'Umm al-Qura')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon={isRTL ? ChevronRight : ChevronLeft} label={tr('الشهر السابق', 'Previous')} onPress={() => shift(-1)} />
        <View style={{ alignItems: 'center' }}>
          <Txt variant="heading">{tr(`${f.hijriMonth(hm.month)} ${hm.year}هـ`, `${f.hijriMonth(hm.month)} ${hm.year} AH`)}</Txt>
          {first && last ? (
            <Txt variant="caption" muted>{`${f.gregorianMonth(first.month)} — ${f.gregorianMonth(last.month)} ${last.year}`}</Txt>
          ) : null}
        </View>
        <IconButton icon={isRTL ? ChevronLeft : ChevronRight} label={tr('الشهر التالي', 'Next')} onPress={() => shift(1)} />
      </View>
      <Card padded={false} style={{ padding: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Txt key={w} variant="label" muted center style={{ flex: 1 }}>
              {f.weekdayShort(i)}
            </Txt>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {Array.from({ length: cells.lead }).map((_, i) => (
            <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 54 }} />
          ))}
          {cells.list.map(({ civil, hd }) => {
            const isToday = civilKey(civil) === civilKey(today);
            const occasion = OCCASIONS[`${hm.month}-${hd}`];
            const white = hd >= 13 && hd <= 15;
            return (
              <View key={hd} style={{ width: `${100 / 7}%`, height: 54, padding: 2 }}>
                <View style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? t.colors.fill : occasion ? t.colors.primarySoft : white ? t.colors.surfaceAlt : 'transparent' }}>
                  <Txt weight="semibold" color={isToday ? '#fff' : t.colors.text}>
                    {hd}
                  </Txt>
                  <Txt variant="label" color={isToday ? 'rgba(255,255,255,0.8)' : t.colors.textFaint}>
                    {civil.day}
                  </Txt>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
      {occasions.length ? (
        <Card style={{ gap: 8 }}>
          <Txt weight="semibold">{tr('أيام هذا الشهر', 'This month')}</Txt>
          {occasions.map(({ civil, hd }) => (
            <View key={hd} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt>{OCCASIONS[`${hm.month}-${hd}`] ?? tr('الأيام البيض (يُستحب صيامها)', 'White days (recommended fasting)')}</Txt>
              <Txt muted>{`${hd} — ${f.weekday(civil)} ${civil.day}/${civil.month}`}</Txt>
            </View>
          ))}
        </Card>
      ) : null}
      <Txt variant="caption" muted center>
        {tr('التواريخ محسوبة وفق تقويم أم القرى، وقد تختلف بيوم بحسب رؤية الهلال المعلنة.', 'Dates follow Umm al-Qura and may differ by a day with the announced moon sighting.')}
      </Txt>
    </Screen>
  );
}
