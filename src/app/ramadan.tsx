import { router } from 'expo-router';
import { BookOpen, Check, MapPin, Moon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { Screen } from '@/components/screen';
import { Badge, Button, Card, Chip, Txt } from '@/components/ui';
import { useNow, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, toGregorian, toHijri } from '@/lib/hijri';
import { computeDay } from '@/lib/prayer-times';
import { bannerState, FAST_REASON_LABEL, upcomingVoluntaryFasts } from '@/lib/ramadan';
import { useSettings } from '@/store/settings';
import { useFastingStore, useKhatmaStore, usePrayerLogStore, useRamadanStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function RamadanScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const fmt = useFormat();
  // Refreshed every minute and when the countdown's target passes; the countdown ticks on its own.
  const [targetAt, setTargetAt] = useState<number | undefined>(undefined);
  const now = useNow(60_000, targetAt);
  const today = useToday(now);
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const digits = useSettings((s) => s.digits);
  const days = useFastingStore((s) => s.days);
  const mark = useFastingStore((s) => s.mark);
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const addKhatma = useKhatmaStore((s) => s.add);
  const prayerDays = usePrayerLogStore((s) => s.days);
  const toggleNafila = usePrayerLogStore((s) => s.toggleNafila);
  const sadaqa = useRamadanStore((s) => s.sadaqa);
  const toggleSadaqa = useRamadanStore((s) => s.toggleSadaqa);

  if (!location) {
    return (
      <Screen title={tr('رمضان والصيام', 'Ramadan & fasting')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const h = toHijri(today, prayer.hijriOffset);
  const banner = bannerState(now, location, prayer);
  const target = banner.kind === 'ramadan' ? banner.target.getTime() : undefined;
  if (target !== targetAt) setTargetAt(target);
  const times = computeDay(today, location, prayer).times;
  const ramadanYear = h.month <= 9 ? h.year : h.year + 1;
  const ramadanStart = toGregorian({ year: ramadanYear, month: 9, day: 1 }, prayer.hijriOffset);
  const ramadanDays = Array.from({ length: 30 }, (_, i) => addCivilDays(ramadanStart, i)).filter((d) => toHijri(d, prayer.hijriOffset).month === 9);
  const fastedInRamadan = ramadanDays.filter((d) => days[civilKey(d)] === 'fasted').length;
  const upcoming = upcomingVoluntaryFasts(today, 30, prayer.hijriOffset);
  // «خطة رمضان»: a khatma, the night prayer and daily charity, tracked across the month.
  const inRamadan = h.month === 9;
  const ramadanKhatma = khatmas.find((k) => k.status === 'active' && k.name.startsWith(tr('ختمة رمضان', 'Ramadan khatma')));
  const qiyamNights = ramadanDays.filter((d) => prayerDays[civilKey(d)]?.nafila?.qiyam).length;
  const sadaqaDays = ramadanDays.filter((d) => sadaqa.includes(civilKey(d))).length;
  const startKhatma = (times: number) => {
    const id = addKhatma({ name: times === 1 ? tr('ختمة رمضان', 'Ramadan khatma') : tr(`ختمة رمضان (${times} ختمات)`, `Ramadan khatma (×${times})`), plan: { kind: 'days', days: Math.round(30 / times) }, start: inRamadan ? today : ramadanStart, reminder: { enabled: true, hour: 21, minute: 0 } });
    router.push({ pathname: '/khatma/[id]', params: { id } });
  };

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
            <Countdown target={banner.target.getTime()} digits={digits} variant="display" color={t.colors.highlight} style={{ fontVariant: ['tabular-nums'] }} />
          </>
        ) : banner.kind === 'before-ramadan' ? (
          <>
            <Txt color="rgba(255,255,255,0.85)">{tr('باقٍ على شهر رمضان', 'Until Ramadan')}</Txt>
            <Txt variant="display" color={t.colors.highlight}>
              {tr(`${banner.daysLeft} يومًا`, `${banner.daysLeft} days`)}
            </Txt>
            <Txt color="rgba(255,255,255,0.85)">{tr(`يبدأ بحسب تقويم أم القرى ${fmt.civil(banner.startsOn)}`, `Expected ${fmt.civil(banner.startsOn)} (Umm al-Qura)`)}</Txt>
          </>
        ) : (
          <>
            <Txt color="rgba(255,255,255,0.85)">{tr(`رمضان ${ramadanYear}هـ يبدأ بحسب تقويم أم القرى`, `Ramadan ${ramadanYear} expected`)}</Txt>
            <Txt variant="title" color={t.colors.highlight}>
              {fmt.civil(ramadanStart)}
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
            {fmt.time(times.fajr, location.timezone)}
          </Txt>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt variant="caption" muted>
            {tr('الإفطار (المغرب)', 'Iftar (Maghrib)')}
          </Txt>
          <Txt variant="heading" color={t.colors.primaryDeep}>
            {fmt.time(times.maghrib, location.timezone)}
          </Txt>
        </Card>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt weight="semibold">{tr(`متابعة صيام رمضان ${ramadanYear}هـ`, `Ramadan ${ramadanYear} log`)}</Txt>
          <Txt muted>{tr(`${fastedInRamadan} من ${ramadanDays.length}`, `${fastedInRamadan} / ${ramadanDays.length}`)}</Txt>
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

      <Card style={{ gap: 12 }}>
        <Txt variant="subheading">{tr('خطة رمضان', 'Ramadan plan')}</Txt>
        <View style={{ gap: 6 }}>
          <Txt weight="semibold">{tr('الختمة', 'Khatma')}</Txt>
          {ramadanKhatma ? (
            <Button title={tr(`تابع ${ramadanKhatma.name}`, `Continue ${ramadanKhatma.name}`)} icon={BookOpen} tone="soft" onPress={() => router.push({ pathname: '/khatma/[id]', params: { id: ramadanKhatma.id } })} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3].map((n) => (
                <Chip key={n} label={n === 1 ? tr('ختمة في الشهر', 'Once in the month') : tr(`${n} ختمات`, `${n} times`)} onPress={() => startKhatma(n)} />
              ))}
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('القيام', 'Night prayer')}</Txt>
            <Txt variant="caption" muted>
              {tr(`${qiyamNights} من ${ramadanDays.length} ليلة`, `${qiyamNights} of ${ramadanDays.length} nights`)}
            </Txt>
          </View>
          {inRamadan ? <Chip label={prayerDays[civilKey(today)]?.nafila?.qiyam ? tr('قمت الليلة ✓', 'Prayed tonight ✓') : tr('قمت الليلة', 'Prayed tonight')} active={Boolean(prayerDays[civilKey(today)]?.nafila?.qiyam)} onPress={() => toggleNafila(today, 'qiyam')} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('الصدقة', 'Charity')}</Txt>
            <Txt variant="caption" muted>
              {tr(`${sadaqaDays} من ${ramadanDays.length} يومًا`, `${sadaqaDays} of ${ramadanDays.length} days`)}
            </Txt>
          </View>
          {inRamadan ? <Chip label={sadaqa.includes(civilKey(today)) ? tr('تصدقت اليوم ✓', 'Gave today ✓') : tr('تصدقت اليوم', 'Gave today')} active={sadaqa.includes(civilKey(today))} onPress={() => toggleSadaqa(today)} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={tr('ليلة القدر', 'Laylat al-Qadr')} onPress={() => router.push('/seasons/qadr')} />
          <Chip label={tr('زكاة الفطر', 'Zakat al-Fitr')} onPress={() => router.push('/zakat')} />
          <Chip label={tr('ست من شوال', 'Six of Shawwal')} onPress={() => router.push('/fasting/plans')} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('صيام التطوع القادم', 'Upcoming voluntary fasts')}</Txt>
        {upcoming.slice(0, 10).map((f) => {
          const key = civilKey(f.date);
          const fh = toHijri(f.date, prayer.hijriOffset);
          return (
            <Pressable key={key} onPress={() => cycle(key, f.date)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt>{`${fmt.weekday(f.date)} ${fmt.civil(f.date)}`}</Txt>
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
