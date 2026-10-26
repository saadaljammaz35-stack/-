import { router } from 'expo-router';
import { CalendarDays, MapPin, Settings2 } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Group, Row, Txt } from '@/components/ui';
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
  const now = useNow(1000);
  const info = usePrayerInfo(now);
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
      <Group>
        <Row icon={MapPin} title={location.name} subtitle={tr(`${location.source === 'gps' ? 'تلقائي (GPS)' : 'يدوي'} — ${location.timezone}`, `${location.source === 'gps' ? 'GPS' : 'Manual'} — ${location.timezone}`)} onPress={() => router.push('/location')} />
        <Row icon={Settings2} title={tr('طريقة الحساب والمذهب', 'Method & madhhab')} subtitle={`${method?.name ?? ''} — ${prayer.madhab === 'hanafi' ? tr('العصر: حنفي', 'Asr: Hanafi') : tr('العصر: الجمهور', 'Asr: standard')}`} onPress={() => router.push('/prayer/settings')} />
        <Row icon={CalendarDays} title={tr('الجدول الشهري', 'Monthly timetable')} onPress={() => router.push('/prayer/month')} />
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
