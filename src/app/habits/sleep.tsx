// «متى أنام لأصحو للفجر؟»: bedtimes in whole sleep cycles that end before tomorrow's Fajr, after
// Isha (the Prophet ﷺ disliked sleeping before it), and an optional midday-rest reminder.
import { router } from 'expo-router';
import { MapPin, Moon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, SwitchRow, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { bedtimes } from '@/lib/habits';
import { addCivilDays } from '@/lib/hijri';
import { computeDay } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** Abu Barzah: he disliked sleeping before Isha and talking after it (agreed upon). */
const ISHA_HADITH = 6365;
const BEFORE = [0, 15, 30];

export default function SleepCalculator() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const n = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);
  const [before, setBefore] = useState(15);

  if (!location) {
    return (
      <Screen title={tr('متى أنام لأصحو للفجر؟', 'When to sleep for Fajr')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const tz = location.timezone;
  const isha = computeDay(today, location, prayer).times.isha;
  const fajr = computeDay(addCivilDays(today, 1), location, prayer).times.fajr;
  const wake = new Date(fajr.getTime() - before * 60_000);
  const options = bedtimes(wake, [6, 5, 4]);

  return (
    <Screen title={tr('متى أنام لأصحو للفجر؟', 'When to sleep for Fajr')} subtitle={tr(`فجر الغد ${f.time(fajr, tz)}`, `Tomorrow’s Fajr ${f.time(fajr, tz)}`)}>
      <View style={{ gap: 6 }}>
        <Txt variant="caption" muted>
          {tr('أستيقظ قبل الأذان بـ', 'Wake before the adhan by')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {BEFORE.map((b) => (
            <Chip key={b} label={b ? tr(`${b} دقيقة`, `${b} min`) : tr('عند الأذان', 'At the adhan')} active={before === b} onPress={() => setBefore(b)} />
          ))}
        </View>
      </View>
      {options.map((o) => {
        const beforeIsha = o.at.getTime() < isha.getTime();
        return (
          <Card key={o.cycles} tone={o.cycles === 5 ? 'primary' : 'surface'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Moon size={22} color={o.cycles === 5 ? t.colors.highlight : t.colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="title" color={o.cycles === 5 ? '#FFFFFF' : undefined}>
                {f.time(o.at, tz)}
              </Txt>
              <Txt variant="caption" color={o.cycles === 5 ? 'rgba(255,255,255,0.85)' : t.colors.textMuted}>
                {tr(`${o.cycles} دورات نوم · ${o.hours} ساعات`, `${o.cycles} cycles · ${o.hours} hours`)}
                {beforeIsha ? tr(' · قبل العشاء', ' · before Isha') : ''}
              </Txt>
            </View>
          </Card>
        );
      })}
      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr(
          `الحساب تقريبي: دورة النوم نحو ساعة ونصف، ويُحتسب ربع ساعة حتى تغفو. صلاة العشاء الليلة ${f.time(isha, tz)}.`,
          `An estimate: a sleep cycle is about ninety minutes, plus a quarter of an hour to fall asleep. Isha tonight is at ${f.time(isha, tz)}.`,
        )}
      </Txt>
      <Evidence id={ISHA_HADITH} />
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <SwitchRow title={tr('تذكير القيلولة', 'Midday rest reminder')} subtitle={tr('بعد الظهر بثلاثة أرباع الساعة', 'Forty-five minutes after Dhuhr')} value={!!n.qailulah?.enabled} onChange={(v) => setNotifications({ qailulah: { enabled: v } })} />
      </View>
    </Screen>
  );
}
