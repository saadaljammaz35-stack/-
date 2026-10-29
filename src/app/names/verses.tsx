// Where a name of Allah occurs in the Quran, word by word.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

import { listPerf } from '@/components/list';
import { Screen } from '@/components/screen';
import { Loading, Txt } from '@/components/ui';
import { getNames, getNameVerses, getSurahs, type Surah, type Verse } from '@/data/content';
import { VerseCard } from '@/features/quran/verse-card';
import { useI18n } from '@/i18n';

export default function NameVersesScreen() {
  const { tr } = useI18n();
  const { n } = useLocalSearchParams<{ n: string }>();
  const num = Number(n);
  const [data, setData] = useState<{ n: number; name: string; verses: Verse[]; surahs: Surah[] } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getNames(), getNameVerses(num), getSurahs()]).then(([names, v, surahs]) => {
      if (alive) setData({ n: num, name: names[num - 1]?.name ?? '', verses: [...v.cited, ...v.occurrences].sort((a, b) => a.id - b.id), surahs });
    });
    return () => {
      alive = false;
    };
  }, [num]);
  const ready = data?.n === num ? data : null;

  return (
    <Screen title={ready ? tr(`«${ready.name}» في القرآن`, `${ready.name} in the Quran`) : tr('في القرآن', 'In the Quran')} subtitle={ready ? tr(`${ready.verses.length} آية`, `${ready.verses.length} verses`) : undefined} scroll={false}>
      {!ready ? (
        <Loading />
      ) : (
        <FlatList
          {...listPerf}
          data={ready.verses}
          keyExtractor={(v) => String(v.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
          ListHeaderComponent={
            <View style={{ paddingBottom: 6 }}>
              <Txt variant="caption" muted>
                {tr('الآيات التي ورد فيها اللفظ في المصحف، ومعها ما استشهد به الخطابي. قد يرد اللفظ في بعضها وصفًا لغير الله تعالى، فاقرأ الآية في سياقها.', 'Verses where the word occurs, with those al-Khattabi cites. In some the word describes someone other than Allah; read each in context.')}
              </Txt>
            </View>
          }
          renderItem={({ item }) => <VerseCard verse={item} surah={ready.surahs[item.surah - 1]} size={20} />}
        />
      )}
    </Screen>
  );
}
