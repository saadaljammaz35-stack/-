// «وقت بلا جوال»: set the phone down for a while. A quiet countdown with the words the Prophet ﷺ
// said are most beloved to Allah, and a gentle alert when the time is up, even if the app is closed.
import * as Notifications from 'expo-notifications';
import { useKeepAwake } from 'expo-keep-awake';
import { Pause, SmartphoneNfc } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const BELOVED = 5475; // The most beloved words to Allah are four (Muslim)
const LIGHT = 5507; // Two words light on the tongue … (agreed upon)
const MINUTES = [15, 30, 60];
const ALERT_ID = 'phone-free-end';

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function PhoneFree() {
  const t = useTheme();
  const { tr } = useI18n();
  const digits = useSettings((s) => s.digits);
  const [minutes, setMinutes] = useState(30);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  const running = until != null && now < until;
  const finished = until != null && now >= until;

  const start = async () => {
    const end = Date.now() + minutes * 60_000;
    setUntil(end);
    setNow(Date.now());
    if (Platform.OS !== 'web') {
      await Notifications.scheduleNotificationAsync({
        identifier: ALERT_ID,
        content: { title: tr('انتهى وقتك بلا جوال', 'Your phone-free time is over'), body: tr('تقبّل الله منك', 'May Allah accept from you'), data: { route: '/habits' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: 'reminders' },
      }).catch(() => undefined);
    }
  };
  const stop = () => {
    setUntil(null);
    if (Platform.OS !== 'web') Notifications.cancelScheduledNotificationAsync(ALERT_ID).catch(() => undefined);
  };

  return (
    <Screen title={tr('وقت بلا جوال', 'Phone-free time')} subtitle={tr('ضع الجوال جانبًا، واذكر الله', 'Put the phone down and remember Allah')}>
      {running ? <KeepAwake /> : null}
      <Card tone="primary" style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <SmartphoneNfc size={32} color={t.colors.highlight} />
        {running ? (
          <>
            <Countdown target={until!} digits={digits} variant="display" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }} />
            <Txt color="rgba(255,255,255,0.9)" center style={{ fontFamily: t.fonts.reading, fontSize: 20, lineHeight: 36 }}>
              {'سُبْحَانَ اللهِ، وَالْحَمْدُ لِلهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ'}
            </Txt>
          </>
        ) : (
          <Txt variant="subheading" color="#FFFFFF" center>
            {finished ? tr('أحسنت، انتهى الوقت', 'Well done — time is up') : tr('كم دقيقة تبتعد عن الجوال؟', 'How long away from the phone?')}
          </Txt>
        )}
      </Card>
      {running ? (
        <Button title={tr('أنهِ الآن', 'End now')} icon={Pause} tone="soft" onPress={stop} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {MINUTES.map((m) => (
              <Chip key={m} label={m === 60 ? tr('ساعة', 'An hour') : tr(`${m} دقيقة`, `${m} min`)} active={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </View>
          <Button title={tr('ابدأ', 'Start')} onPress={start} />
        </>
      )}
      <Evidence id={BELOVED} full />
      <Evidence id={LIGHT} />
    </Screen>
  );
}
