// «منبّه الفجر بالآية»: opened by the Fajr alert. The alert keeps repeating until a verse about the
// prayer is read here; the button unlocks after a few seconds, enough to read it.
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Sunrise } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, QuranText, Txt } from '@/components/ui';
import { getSurahs, getVerseByKey, type Verse } from '@/data/content';
import { stopFajrWake } from '@/features/notifications';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { civilKey } from '@/lib/hijri';
import { useTheme } from '@/theme';

/** Verses about the prayer and its times; one each day. */
const VERSES: [number, number][] = [
  [17, 78],
  [2, 238],
  [20, 14],
  [4, 103],
  [29, 45],
  [11, 114],
];
const READ_SECONDS = 8;

export default function FajrWake() {
  useKeepAwake();
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [surah, setSurah] = useState('');
  const [left, setLeft] = useState(READ_SECONDS);

  useEffect(() => {
    const [s, a] = VERSES[(today.year * 372 + today.month * 31 + today.day) % VERSES.length];
    Promise.all([getVerseByKey(s, a), getSurahs()]).then(([v, list]) => {
      setVerse(v);
      setSurah(list[s - 1]?.name ?? '');
    });
  }, [today]);
  useEffect(() => {
    if (!verse || left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [verse, left]);

  const done = async () => {
    await stopFajrWake(civilKey(today));
    router.replace('/between');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.mushafPaper, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20, paddingHorizontal: 22, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Sunrise size={40} color={t.colors.gold} />
        <Txt variant="title" center color={t.colors.primaryDeep}>
          {tr('الصلاة خير من النوم', 'Prayer is better than sleep')}
        </Txt>
        <Txt muted center>
          {tr('اقرأ هذه الآية ليتوقف التنبيه', 'Read this verse to stop the alert')}
        </Txt>
      </View>
      {verse ? (
        <View style={{ gap: 10 }}>
          <QuranText size={verse.textQpc.length > 140 ? 26 : 30}>{`${verse.textQpc} ${toArabicDigits(verse.ayah)}`}</QuranText>
          <Txt variant="caption" muted center>
            {`سورة ${surah}: ${verse.ayah}`}
          </Txt>
        </View>
      ) : null}
      <Button title={left > 0 ? tr(`اقرأ… ${left}`, `Read… ${left}`) : tr('قرأتها، أوقف التنبيه', 'I read it — stop the alert')} disabled={left > 0} onPress={done} style={{ minHeight: 60 }} />
    </View>
  );
}
