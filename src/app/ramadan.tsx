import { router } from 'expo-router';
import { Check, MapPin, Moon, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, Txt } from '@/components/ui';
import { useNow, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { addCivilDays, civilKey, formatCivil, toGregorian, toHijri, WEEKDAYS, civilWeekday } from '@/lib/hijri';
import { computeDay } from '@/lib/prayer-times';
import { bannerState, FAST_REASON_LABEL, upcomingVoluntaryFasts } from '@/lib/ramadan';
import { formatCountdown, formatTime } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useFastingStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function RamadanScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const now = useNow(1000);
  const today = useToday(now);
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const digits = useSettings((s) => s.digits);
  const days = useFastingStore((s) => s.days);
  const mark = useFastingStore((s) => s.mark);

  if (!location) {
    return (
      <Screen title={tr('رمضان والصيام', 'Ramadan & fasting')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const h = toHijri(today, prayer.hijriOffset);
  const banner = bannerState(now, location, prayer);
  const times = computeDay(today, location, prayer).times;
  const ramadanYear = h.month <= 9 ? h.year : h.year + 1;
  const ramadanStart = toGregorian({ year: ramadanYear, month: 9, day: 1 }, prayer.hijriOffset);
  const ramadanDays = Array.from({ length: 30 }, (_, i) => addCivilDays(ramadanStart, i)).filter((d) => toHijri(d, prayer.hijriOffset).month === 9);
  const fastedInRamadan = ramadanDays.filter((d) => days[civilKey(d)] === 'fasted').length;
  const upcoming = upcomingVoluntaryFasts(today, 30, prayer.hijriOffset);

  const cycle = (key: string, date: typeof today) => {
    const current = days[key];
    mark(date, current == null ? 'fasted' : current === 'fasted' ? 'missed' : current === 'missed' ? 'excused' : null);
  };

  return (
    <Screen title={tr('رمضان والصيام', 'Ramadan & fasting')}>
      <Card tone="primary" style={{ gap: 6, alignItems: 'center', paddingVertical: 22 }}>
        <Moon size={28} color={t.colors.highlight} />
        {banner.kind === 'ramadan' ? (
          <>
            <Txt color="#fff" variant="subheading">
              {tr(`اليوم ${banner.day} من رمضان ${ramadanYear}هـ`, `Day ${banner.day} of Ramadan`)}
            </Txt>
            <Txt color="rgba(255,255,255,0.85)">{banner.phase === 'until-iftar' ? tr('الوقت المتبقي على الإفطار', 'Time until iftar') : tr('الوقت المتبقي على الإمساك (أذان الفجر)', 'Time until imsak (Fajr)')}</Txt>
            <Txt variant="display" color={t.colors.highlight} style={{ fontVariant: ['tabular-nums'] }}>
              {formatCountdown(banner.target.getTime() - now.getTime(), digits)}
            </Txt>
          </>
        ) : banner.kind === 'before-ramadan' ? (
          <>
            <Txt color="rgba(255,255,255,0.85)">{tr('باقٍ على شهر رمضان', 'Until Ramadan')}</Txt>
            <Txt variant="display" color={t.colors.highlight}>
              {tr(`${banner.daysLeft} يومًا`, `${banner.daysLeft} days`)}
            </Txt>
            <Txt color="rgba(255,255,255,0.85)">{tr(`يبدأ بحسب تقويم أم القرى ${formatCivil(banner.startsOn)}`, `Expected ${formatCivil(banner.startsOn)} (Umm al-Qura)`)}</Txt>
          </>
        ) : (
          <>
            <Txt color="rgba(255,255,255,0.85)">{tr(`رمضان ${ramadanYear}هـ يبدأ بحسب تقويم أم القرى`, `Ramadan ${ramadanYear} expected`)}</Txt>
            <Txt variant="title" color={t.colors.highlight}>
              {formatCivil(ramadanStart)}
            </Txt>
          </>
        )}
        <Txt variant="caption" color="rgba(255,255,255,0.7)" center>
          {tr('يُعتمد في دخول الشهر على إعلان الجهات الرسمية برؤية الهلال.', 'The start of the month follows the official moon-sighting announcement.')}
        </Txt>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt variant="caption" muted>
            {tr('السحور حتى (الفجر)', 'Suhoor until (Fajr)')}
          </Txt>
          <Txt variant="heading" color={t.colors.primaryDeep}>
            {formatTime(times.fajr, location.timezone, digits)}
          </Txt>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt variant="caption" muted>
            {tr('الإفطار (المغرب)', 'Iftar (Maghrib)')}
          </Txt>
          <Txt variant="heading" color={t.colors.primaryDeep}>
            {formatTime(times.maghrib, location.timezone, digits)}
          </Txt>
        </Card>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt weight="semibold">{tr(`متابعة صيام رمضان ${ramadanYear}هـ`, `Ramadan ${ramadanYear} log`)}</Txt>
          <Txt muted>{tr(`${fastedInRamadan} / ${ramadanDays.length}`, `${fastedInRamadan} / ${ramadanDays.length}`)}</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ramadanDays.map((d, i) => {
            const key = civilKey(d);
            const v = days[key];
            const future = key > civilKey(today);
            return (
              <Pressable
                key={key}
                disabled={future}
                onPress={() => cycle(key, d)}
                accessibilityLabel={tr(`اليوم ${i + 1}`, `Day ${i + 1}`)}
                style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.4 : 1, backgroundColor: v === 'fasted' ? t.colors.primary : v === 'missed' ? '#F6DEDA' : v === 'excused' ? '#EEF0D2' : t.colors.surfaceAlt }}>
                {v === 'fasted' ? <Check size={16} color="#fff" /> : v === 'missed' ? <X size={16} color={t.colors.danger} /> : <Txt variant="caption">{i + 1}</Txt>}
              </Pressable>
            );
          })}
        </View>
        <Txt variant="label" muted>
          {tr('اضغط على اليوم: صُمت ← فاتني ← عذر شرعي ← إزالة', 'Tap a day: fasted → missed → excused → clear')}
        </Txt>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('صيام التطوع القادم', 'Upcoming voluntary fasts')}</Txt>
        {upcoming.slice(0, 10).map((f) => {
          const key = civilKey(f.date);
          const fh = toHijri(f.date, prayer.hijriOffset);
          return (
            <Pressable key={key} onPress={() => cycle(key, f.date)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt>{`${WEEKDAYS[civilWeekday(f.date)]} ${formatCivil(f.date)}`}</Txt>
                <Txt variant="caption" muted>{`${fh.day}/${fh.month}/${fh.year}هـ`}</Txt>
              </View>
              <Badge label={FAST_REASON_LABEL[f.reason]} tone={f.reason === 'white-days' || f.reason === 'arafah' ? 'sahih' : 'soft'} />
              {days[key] === 'fasted' ? <Check size={18} color={t.colors.primary} /> : null}
            </Pressable>
          );
        })}
        <Button title={tr('تذكير بصيام التطوع', 'Remind me of voluntary fasts')} tone="soft" onPress={() => router.push('/settings/notifications')} />
      </Card>
    </Screen>
  );
}
