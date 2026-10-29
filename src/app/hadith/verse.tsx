// «الحديث تحت الآية»: the hadiths of the encyclopedia that quote a verse, those quoting it in
// their own text first, then those whose explanation cites it.
import { useLocalSearchParams } from 'expo-router';
import { ScrollText } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Screen } from '@/components/screen';
import { EmptyState, Loading, Txt } from '@/components/ui';
import { getSurahs, getVerse, getVerseHadiths, type Surah, type Verse, type VerseHadith } from '@/data/content';
import { Evidence } from '@/features/hadith/evidence';
import { VerseCard } from '@/features/quran/verse-card';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export default function VerseHadithsScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const verseId = Number(id);
  const [data, setData] = useState<{ id: number; verse: Verse | null; surahs: Surah[]; hadiths: VerseHadith[] } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getVerse(verseId), getSurahs(), getVerseHadiths(verseId)]).then(([verse, surahs, hadiths]) => alive && setData({ id: verseId, verse, surahs, hadiths }));
    return () => {
      alive = false;
    };
  }, [verseId]);

  const ready = data?.id === verseId ? data : null;
  const quoted = ready?.hadiths.filter((h) => h.inText) ?? [];
  const cited = ready?.hadiths.filter((h) => !h.inText) ?? [];

  return (
    <Screen title={tr('أحاديث تذكر الآية', 'Hadiths citing this verse')}>
      {!ready ? (
        <Loading />
      ) : (
        <>
          {ready.verse ? <VerseCard verse={ready.verse} surah={ready.surahs[ready.verse.surah - 1]} /> : null}
          {quoted.length ? (
            <Txt weight="bold" color={t.colors.primaryDeep}>
              {tr('ورد نص الآية في الحديث', 'The hadith quotes the verse')}
            </Txt>
          ) : null}
          {quoted.map((h) => (
            <Evidence key={h.id} id={h.id} />
          ))}
          {cited.length ? (
            <Txt weight="bold" color={t.colors.primaryDeep} style={{ marginTop: 6 }}>
              {tr('استُشهد بالآية في شرح الحديث', 'Cited in the hadith’s explanation')}
            </Txt>
          ) : null}
          {cited.map((h) => (
            <Evidence key={h.id} id={h.id} />
          ))}
          {!ready.hadiths.length ? <EmptyState icon={ScrollText} title={tr('لا أحاديث مرتبطة بهذه الآية', 'No linked hadiths')} /> : null}
          <Txt variant="caption" muted center>
            {tr('الربط آلي بنص الآية كما ورد بين الأقواس القرآنية في «موسوعة الأحاديث النبوية»، ولا يُذكر إلا ما تطابق نصه مع آية واحدة.', 'Linked automatically where the Encyclopedia of Prophetic Hadiths quotes the verse’s exact words, only when they match a single verse.')}
          </Txt>
        </>
      )}
    </Screen>
  );
}
