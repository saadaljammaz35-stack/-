import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { StarMark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Button, Card, Loading, ReadingText, Txt } from '@/components/ui';
import { getNames, getNameVerses, getSurahs, type NameOfAllah, type NameVerses, type Surah } from '@/data/content';
import { openShare } from '@/features/home/daily-cards';
import { VerseCard } from '@/features/quran/verse-card';
import { useI18n } from '@/i18n';
import { useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function NameDetail() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const { n } = useLocalSearchParams<{ n: string }>();
  const [names, setNames] = useState<NameOfAllah[]>([]);
  const favorites = useAdhkarStore((s) => s.favorites);
  const toggle = useAdhkarStore((s) => s.toggleFavorite);
  const [quran, setQuran] = useState<{ n: number; verses: NameVerses; surahs: Surah[] } | null>(null);
  useEffect(() => {
    getNames().then(setNames);
  }, []);
  useEffect(() => {
    let alive = true;
    const num = Number(n);
    Promise.all([getNameVerses(num), getSurahs()]).then(([verses, surahs]) => alive && setQuran({ n: num, verses, surahs }));
    return () => {
      alive = false;
    };
  }, [n]);
  const index = Number(n) - 1;
  const inQuran = quran?.n === Number(n) ? quran : null;
  const name = names[index];
  if (!name) return <Screen title={tr('أسماء الله الحسنى', 'Names of Allah')}><Loading /></Screen>;
  const key = `name:${name.n}`;
  const fav = favorites.includes(key);
  const go = (d: number) => router.setParams({ n: String(((index + d + 99) % 99) + 1) });

  return (
    <Screen
      title={name.name}
      subtitle={tr(`الاسم ${name.n} من 99`, `Name ${name.n} of 99`)}
      actions={[
        { icon: Heart, label: tr('المفضلة', 'Favourite'), onPress: () => toggle(key) },
        { icon: Share2, label: tr('مشاركة', 'Share'), onPress: () => openShare({ title: tr('من أسماء الله الحسنى', 'A beautiful name of Allah'), text: name.name, reference: tr('شرح الخطابي في «شأن الدعاء»', 'al-Khattabi, Sha’n al-Du‘a’') }) },
      ]}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
        <StarMark size={64} />
        <Txt style={{ fontFamily: t.fonts.readingBold, fontSize: 46, lineHeight: 80 }} color={t.colors.primaryDeep}>
          {name.name}
        </Txt>
        {fav ? <Heart size={18} color={t.colors.danger} fill={t.colors.danger} /> : null}
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {tr('الشرح', 'Explanation')}
        </Txt>
        <ReadingText size={19}>{name.explanation}</ReadingText>
        <Txt variant="caption" muted>
          {tr(`الإمام الخطابي، «شأن الدعاء»، تحقيق أحمد يوسف الدقاق — الفقرة ${name.khattabiNumber}`, `al-Khattabi, Sha’n al-Du‘a’ — §${name.khattabiNumber}`)}
        </Txt>
      </Card>
      {inQuran && (inQuran.verses.cited.length || inQuran.verses.occurrences.length) ? (
        <Card style={{ gap: 10 }}>
          <Txt weight="semibold" color={t.colors.primaryDeep}>
            {tr('في القرآن الكريم', 'In the Quran')}
          </Txt>
          {inQuran.verses.cited.length ? (
            <>
              <Txt variant="caption" muted>
                {tr('آيات استشهد بها الخطابي على هذا الاسم:', 'Verses al-Khattabi cites for this name:')}
              </Txt>
              {inQuran.verses.cited.map((v) => (
                <VerseCard key={v.id} verse={v} surah={inQuran.surahs[v.surah - 1]} size={20} />
              ))}
            </>
          ) : null}
          {inQuran.verses.occurrences.length ? (
            <Button
              title={tr(`كل مواضع اللفظ في المصحف (${inQuran.verses.cited.length + inQuran.verses.occurrences.length} آية)`, `Every verse with the word (${inQuran.verses.cited.length + inQuran.verses.occurrences.length})`)}
              icon={BookOpen}
              tone="soft"
              onPress={() => router.push({ pathname: '/names/verses', params: { n: String(name.n) } })}
            />
          ) : null}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title={tr('السابق', 'Previous')} icon={isRTL ? ChevronRight : ChevronLeft} tone="soft" style={{ flex: 1 }} onPress={() => go(-1)} />
        <Button title={tr('التالي', 'Next')} icon={isRTL ? ChevronLeft : ChevronRight} tone="soft" style={{ flex: 1 }} onPress={() => go(1)} />
      </View>
    </Screen>
  );
}
