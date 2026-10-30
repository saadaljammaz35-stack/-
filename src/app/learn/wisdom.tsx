// «حِكم العبادات من القرآن»: what the Quran itself says each act of worship is for.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '@/components/screen';
import { Card, QuranText, Txt } from '@/components/ui';
import { getSurahs, getVerseByKey, type Surah, type Verse } from '@/data/content';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';

const ITEMS: { ar: string; en: string; key: [number, number] }[] = [
  { ar: 'الصلاة', en: 'Prayer', key: [29, 45] },
  { ar: 'الصيام', en: 'Fasting', key: [2, 183] },
  { ar: 'الزكاة والصدقة', en: 'Zakat and charity', key: [9, 103] },
  { ar: 'الحج', en: 'Hajj', key: [22, 28] },
  { ar: 'ذكر الله', en: 'Remembering Allah', key: [13, 28] },
  { ar: 'الدعاء', en: 'Supplication', key: [2, 186] },
  { ar: 'العبادة كلها', en: 'Worship itself', key: [51, 56] },
];

export default function WorshipWisdom() {
  const { tr } = useI18n();
  const [verses, setVerses] = useState<(Verse | null)[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    Promise.all(ITEMS.map((i) => getVerseByKey(i.key[0], i.key[1]))).then(setVerses);
    getSurahs().then(setSurahs);
  }, []);
  const open = (v: Verse) => {
    useMushafNav.getState().go(v.page, v.id);
    router.push({ pathname: '/mushaf', params: { page: String(v.page), verse: String(v.id) } });
  };

  return (
    <Screen title={tr('حِكم العبادات من القرآن', 'The wisdom of worship')} subtitle={tr('لماذا نعبد؟ بآيات الكتاب', 'Why we worship — in the words of the Quran')}>
      {ITEMS.map((item, i) => {
        const v = verses[i];
        return v ? (
          <Card key={item.ar} onPress={() => open(v)} style={{ gap: 8 }}>
            <Txt variant="subheading">{tr(item.ar, item.en)}</Txt>
            <QuranText size={21}>{`${v.textQpc} ${toArabicDigits(v.ayah)}`}</QuranText>
            <Txt variant="caption" muted center>{`سورة ${surahs[v.surah - 1]?.name ?? ''}: ${v.ayah}`}</Txt>
          </Card>
        ) : null;
      })}
      <Txt variant="caption" muted center>
        {tr('المس الآية لتفتحها في المصحف وتقرأ تفسيرها.', 'Tap a verse to open it in the mushaf and read its tafsir.')}
      </Txt>
    </Screen>
  );
}
