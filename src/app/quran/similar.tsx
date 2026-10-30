// «الآيات المتشابهة»: verses that share a run of words with this one, with the shared words shown,
// so a memoriser can tell them apart.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Loading, QuranText, Txt } from '@/components/ui';
import { getSimilarVerses, getSurahs, getVerse, type SimilarVerse, type Verse } from '@/data/content';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useTheme } from '@/theme';

export default function SimilarVerses() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [surah, setSurah] = useState('');
  const [list, setList] = useState<SimilarVerse[] | null>(null);

  useEffect(() => {
    const vid = Number(id);
    Promise.all([getVerse(vid), getSurahs(), getSimilarVerses(vid, 20)]).then(([v, s, l]) => {
      setVerse(v);
      setSurah(v ? (s[v.surah - 1]?.name ?? '') : '');
      setList(l);
    });
  }, [id]);

  const open = (v: Verse) => {
    useMushafNav.getState().go(v.page, v.id);
    router.push({ pathname: '/mushaf', params: { page: String(v.page), verse: String(v.id) } });
  };

  return (
    <Screen title={tr('الآيات المتشابهة', 'Similar verses')} subtitle={verse ? `${surah}: ${verse.ayah}` : undefined}>
      {verse ? (
        <Card tone="soft">
          <QuranText size={22}>{`${verse.textQpc} ${toArabicDigits(verse.ayah)}`}</QuranText>
        </Card>
      ) : null}
      {!list ? (
        <Loading />
      ) : (
        list.map((v) => (
          <Card key={v.id} onPress={() => open(v)} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt weight="semibold" style={{ flex: 1 }}>{`${v.surahName}: ${v.ayah}`}</Txt>
              <Txt variant="caption" muted>
                {tr(`ص ${v.page}`, `p. ${v.page}`)}
              </Txt>
            </View>
            <QuranText size={20}>{`${v.textQpc} ${toArabicDigits(v.ayah)}`}</QuranText>
            <Txt variant="caption" color={t.colors.primaryDeep}>
              {tr(`المشترك: «${v.shared}»`, `Shared: “${v.shared}”`)}
            </Txt>
          </Card>
        ))
      )}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('تُعرض الآيات التي تشترك معها في أربع كلمات متتالية فأكثر، بعد توحيد الرسم للمقارنة.', 'Verses sharing four or more consecutive words with it, compared on a normalised spelling.')}
      </Txt>
    </Screen>
  );
}
