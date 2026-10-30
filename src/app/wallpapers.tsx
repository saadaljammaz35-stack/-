// «خلفيات الجوال»: today's ayah, or a verse you choose, as a phone wallpaper in the app's design.
import { useEffect, useState } from 'react';

import { Screen } from '@/components/screen';
import { Card, QuranText, Txt } from '@/components/ui';
import { getDailyAyah, getSurahs, getVerseByKey, type Surah, type Verse } from '@/data/content';
import { openShare } from '@/features/home/daily-cards';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';

const VERSES: [number, number][] = [
  [2, 152],
  [13, 28],
  [94, 6],
  [65, 3],
  [39, 53],
  [2, 186],
  [3, 139],
  [20, 25],
];

export default function Wallpapers() {
  const { tr } = useI18n();
  const today = useToday();
  const [daily, setDaily] = useState<{ text: string; reference: string } | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getDailyAyah(today).then((a) => setDaily({ text: a.text, reference: a.reference ?? '' }));
    Promise.all(VERSES.map(([s, a]) => getVerseByKey(s, a))).then((l) => setVerses(l.filter((v): v is Verse => v != null)));
    getSurahs().then(setSurahs);
  }, [today]);

  const open = (text: string, reference: string) => openShare({ title: tr('مع الله', 'Ma Allah'), text, reference, quran: true, wallpaper: true });

  return (
    <Screen title={tr('خلفيات الجوال', 'Phone wallpapers')} subtitle={tr('آية اليوم أو آية تختارها', 'Today’s ayah or one you choose')}>
      {daily ? (
        <Card tone="primary" onPress={() => open(daily.text, daily.reference)} style={{ gap: 6 }}>
          <Txt variant="subheading" color="#FFFFFF">
            {tr('آية اليوم', 'Today’s ayah')}
          </Txt>
          <Txt color="rgba(255,255,255,0.9)" numberOfLines={3}>
            {daily.text}
          </Txt>
        </Card>
      ) : null}
      {verses.map((v) => {
        const ref = `سورة ${surahs[v.surah - 1]?.name ?? ''}: ${v.ayah}`;
        const text = `${v.textQpc} ${toArabicDigits(v.ayah)}`;
        return (
          <Card key={v.id} onPress={() => open(text, ref)} style={{ gap: 4 }}>
            <QuranText size={20}>{text}</QuranText>
            <Txt variant="caption" muted center>
              {ref}
            </Txt>
          </Card>
        );
      })}
    </Screen>
  );
}
