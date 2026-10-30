// «ورد النوم»: what the Prophet ﷺ read at night — al-Mulk and as-Sajdah before sleeping, and the
// last two verses of al-Baqarah — each with the hadith it comes from.
import { router } from 'expo-router';
import { BookOpen, Headphones, Moon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { getSurahs, getVerseByKey, type Surah, type Verse } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { Evidence } from '@/features/hadith/evidence';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';

/** HadeethEnc: al-Mulk interceded for a man; he ﷺ did not sleep before al-Sajdah and al-Mulk; the two last verses of al-Baqarah suffice. */
const MULK_HADITH = 6260;
const NIGHT_HADITH = 65260;
const BAQARAH_HADITH = 6274;

export default function SleepWird() {
  const { tr } = useI18n();
  const player = usePlayer();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [baqarah, setBaqarah] = useState<Verse | null>(null);
  useEffect(() => {
    getSurahs().then(setSurahs);
    getVerseByKey(2, 285).then(setBaqarah);
  }, []);

  const read = (page: number, verse?: number) => {
    useMushafNav.getState().go(page, verse);
    router.push({ pathname: '/mushaf', params: { page: String(page), ...(verse ? { verse: String(verse) } : {}) } });
  };
  const mulk = surahs[66];
  const sajdah = surahs[31];

  return (
    <Screen title={tr('ورد النوم', 'Bedtime wird')} subtitle={tr('ما كان النبي ﷺ يقرؤه قبل أن ينام', 'What the Prophet ﷺ read before sleeping')}>
      {mulk ? (
        <Card style={{ gap: 10 }}>
          <Txt variant="subheading">{tr('سورة الملك', 'Surat al-Mulk')}</Txt>
          <Evidence id={MULK_HADITH} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={tr('اقرأ', 'Read')} icon={BookOpen} style={{ flex: 1 }} onPress={() => read(mulk.pageStart)} />
            <Button title={tr('استمع', 'Listen')} icon={Headphones} tone="soft" style={{ flex: 1 }} onPress={() => (player.setRepeat({ kind: 'off' }), player.playSurah(67, 1))} />
          </View>
        </Card>
      ) : null}
      {sajdah ? (
        <Card style={{ gap: 10 }}>
          <Txt variant="subheading">{tr('سورة السجدة', 'Surat as-Sajdah')}</Txt>
          <Evidence id={NIGHT_HADITH} full />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={tr('اقرأ', 'Read')} icon={BookOpen} style={{ flex: 1 }} onPress={() => read(sajdah.pageStart)} />
            <Button title={tr('استمع', 'Listen')} icon={Headphones} tone="soft" style={{ flex: 1 }} onPress={() => (player.setRepeat({ kind: 'off' }), player.playSurah(32, 1))} />
          </View>
        </Card>
      ) : null}
      {baqarah ? (
        <Card style={{ gap: 10 }}>
          <Txt variant="subheading">{tr('آخر آيتين من سورة البقرة', 'The last two verses of al-Baqarah')}</Txt>
          <Evidence id={BAQARAH_HADITH} full />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={tr('اقرأ', 'Read')} icon={BookOpen} style={{ flex: 1 }} onPress={() => read(baqarah.page, baqarah.id)} />
            <Button
              title={tr('استمع', 'Listen')}
              icon={Headphones}
              tone="soft"
              style={{ flex: 1 }}
              onPress={() => {
                player.setRepeat({ kind: 'range', from: 285, to: 286, times: 1 });
                player.playSurah(2, 285);
              }}
            />
          </View>
        </Card>
      ) : null}
      <Button title={tr('أذكار النوم', 'Sleep adhkar')} icon={Moon} tone="soft" onPress={() => router.push('/adhkar/sleep')} />
    </Screen>
  );
}
