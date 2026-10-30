import { router } from 'expo-router';
import { Ban, BellOff, CalendarClock, CalendarDays, Droplets, Globe, Hourglass, MapPin, Monitor, Plane, Settings2, Sparkle, SunDim } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Group, Row, Txt } from '@/components/ui';
import { LiveCountdownSwitch } from '@/features/live-countdown-switch';
import { liveCountdownSupported } from '@/features/live-countdown';
import { PrayerGrid } from '@/features/prayer/prayer-grid';
import { useNow, usePrayerInfo } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toHijri } from '@/lib/hijri';
import { METHODS } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

export default function PrayerScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  // Refreshed every minute and when the next prayer begins; the countdown ticks on its own.
  const [nextAt, setNextAt] = useState<number | undefined>(undefined);
  const now = useNow(60_000, nextAt);
  const info = usePrayerInfo(now);
  const upcoming = info?.next.at.getTime();
  if (upcoming !== nextAt) setNextAt(upcoming);
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const method = METHODS.find((m) => m.id === prayer.method);

  if (!location || !info) {
    return (
      <Screen title={tr('مواقيت الصلاة', 'Prayer times')}>
        <Card style={{ gap: 10 }}>
          <Txt>{tr('حدّد موقعك لعرض المواقيت.', 'Set your location to see prayer times.')}</Txt>
          <Button title={tr('تحديد الموقع', 'Set location')} icon={MapPin} onPress={() => router.push('/location')} />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title={tr('مواقيت الصلاة', 'Prayer times')} subtitle={`${f.hijri(toHijri(info.day.date, prayer.hijriOffset))} — ${f.civil(info.day.date)}`}>
      <PrayerGrid day={info.day} next={info.next} now={now} showBells />
      <Card style={{ gap: 6 }}>
        <Txt weight="semibold">{tr('أوقات الليل', 'Night')}</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt muted>{tr('منتصف الليل', 'Midnight')}</Txt>
          <Txt>{f.time(info.day.midnight, location.timezone)}</Txt>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt muted>{tr('بداية الثلث الأخير', 'Last third begins')}</Txt>
          <Txt>{f.time(info.day.lastThird, location.timezone)}</Txt>
        </View>
      </Card>
      {liveCountdownSupported ? (
        <Group>
          <LiveCountdownSwitch />
        </Group>
      ) : null}
      <Group>
        <Row icon={MapPin} title={location.name} subtitle={tr(`${location.source === 'gps' ? 'تلقائي (GPS)' : 'يدوي'} — ${location.timezone}`, `${location.source === 'gps' ? 'GPS' : 'Manual'} — ${location.timezone}`)} onPress={() => router.push('/location')} />
        <Row icon={Settings2} title={tr('طريقة الحساب والمذهب', 'Method & madhhab')} subtitle={`${method?.name ?? ''} — ${prayer.madhab === 'hanafi' ? tr('العصر: حنفي', 'Asr: Hanafi') : tr('العصر: الجمهور', 'Asr: standard')}`} onPress={() => router.push('/prayer/settings')} />
        <Row icon={CalendarDays} title={tr('الجدول الشهري', 'Monthly timetable')} onPress={() => router.push('/prayer/month')} />
        <Row icon={CalendarClock} title={tr('الصلاة في تقويمك', 'Prayer in your calendar')} subtitle={tr('المواقيت في تقويم الجوال، ومواعيد تتقاطع مع الصلاة', 'Times in your phone’s calendar, and appointments that meet a prayer')} onPress={() => router.push('/prayer/calendar')} />
        <Row icon={Hourglass} title={tr('بين الأذان والإقامة', 'Between adhan and iqama')} subtitle={tr('عدّاد الإقامة، ودعاؤك، وما تراجعه من حفظك في الصلاة', 'Iqama countdown, your duas, and verses to review in prayer')} onPress={() => router.push('/between')} />
        <Row icon={Ban} title={tr('أوقات النهي والضحى', 'Forbidden times & Duha')} subtitle={tr('متى لا يُتطوّع بالصلاة، ووقت الضحى اليوم', 'When not to pray voluntary prayers, and today’s Duha')} onPress={() => router.push('/prayer/windows')} />
        <Row icon={Sparkle} title={tr('السنن والنوافل', 'Sunnah prayers')} subtitle={tr('الرواتب والوتر والضحى بأدلتها', 'The regular sunnahs, witr and Duha')} onPress={() => router.push('/prayer/nawafil')} />
        <Row icon={Globe} title={tr('مواقيت مدن أهلي', 'Family cities')} onPress={() => router.push('/prayer/cities')} />
        <Row icon={Droplets} title={tr('الوضوء والصلاة خطوة بخطوة', 'Wudu and prayer step by step')} onPress={() => router.push('/prayer/guide')} />
        <Row icon={SunDim} title={tr('ظل العصر', 'The Asr shadow')} subtitle={tr('طول الظل الآن، ومتى يدخل العصر', 'The shadow now, and when Asr begins')} onPress={() => router.push('/prayer/shadow')} />
        <Row icon={BellOff} title={tr('صامت في المسجد', 'Silent at the mosque')} onPress={() => router.push('/mosque-silent')} />
        <Row icon={Plane} title={tr('دليل السفر والصلاة في الطائرة', 'Travel guide & flights')} onPress={() => router.push('/travel')} />
        <Row icon={Monitor} title={tr('شاشة المسجد', 'Mosque screen')} subtitle={tr('لوحة المواقيت والإقامة لتلفاز المسجد أو جهاز لوحي', 'A times and iqama board for a mosque TV or tablet')} onPress={() => router.push('/mosque-screen')} />
      </Group>
      <Txt variant="caption" muted center>
        {tr('اضغط على الجرس لكتم تنبيه أي صلاة أو تفعيله. تخصيص صوت الأذان والتنبيه المسبق من إعدادات الإشعارات.', 'Tap a bell to mute or enable that prayer. Adhan sound and early alert are in notification settings.')}
      </Txt>
      <Button title={tr('إعدادات الإشعارات', 'Notification settings')} tone="soft" onPress={() => router.push('/settings/notifications')} />
      <Txt variant="label" muted center style={{ color: t.colors.textFaint }}>
        {tr('الحساب بمكتبة Adhan المفتوحة المصدر وفق معاملات الجهات الرسمية.', 'Computed with the open-source Adhan library using official parameters.')}
      </Txt>
    </Screen>
  );
}
