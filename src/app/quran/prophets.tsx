// «الأنبياء في القرآن»: the twenty-five prophets named in the Quran in their well-known order, each
// with the verses that name him, gathered from every surah.
import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Loading, QuranText, Txt } from '@/components/ui';
import { versesMatchingEach, type QuranHit } from '@/data/content';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { PROPHETS, prophetPatterns } from '@/lib/prophets';
import { useTheme } from '@/theme';

export default function ProphetsInQuran() {
  const t = useTheme();
  const { tr } = useI18n();
  const [verses, setVerses] = useState<Record<string, QuranHit[]>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    versesMatchingEach(PROPHETS.map(prophetPatterns)).then((lists) => {
      if (alive) setVerses(Object.fromEntries(PROPHETS.map((p, i) => [p.ar, lists[i]])));
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = (v: QuranHit) => {
    useMushafNav.getState().go(v.page, v.id);
    router.push({ pathname: '/mushaf', params: { page: String(v.page), verse: String(v.id) } });
  };

  return (
    <Screen title={tr('الأنبياء في القرآن', 'The prophets in the Quran')} subtitle={tr('خمسة وعشرون نبيًا ذُكروا بأسمائهم', 'Twenty-five named prophets')}>
      {PROPHETS.map((p, i) => {
        const list = verses[p.ar];
        const surahs = list ? new Set(list.map((v) => v.surah)).size : 0;
        return (
          <Card key={p.ar} padded={false}>
            <Pressable onPress={() => setOpen(open === p.ar ? null : p.ar)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: t.colors.primarySoft }} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold">{tr(`${i + 1}. ${p.ar} عليه السلام`, `${i + 1}. ${p.en}`).replace('محمد ﷺ عليه السلام', 'محمد ﷺ')}</Txt>
                <Txt variant="caption" muted>
                  {list ? tr(`في ${list.length} آية من ${surahs} سورة`, `In ${list.length} verses of ${surahs} surahs`) : '…'}
                </Txt>
              </View>
              <ChevronDown size={18} color={t.colors.textFaint} style={{ transform: [{ rotate: open === p.ar ? '180deg' : '0deg' }] }} />
            </Pressable>
            {open === p.ar
              ? !list
                ? <Loading />
                : list.map((v) => (
                    <Pressable key={v.id} onPress={() => go(v)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: t.colors.border, gap: 4 }}>
                      <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>{`${v.surahName}: ${v.ayah}`}</Txt>
                      <QuranText size={19} style={{ textAlign: 'right' }}>{`${v.textQpc} ${toArabicDigits(v.ayah)}`}</QuranText>
                    </Pressable>
                  ))
              : null}
          </Card>
        );
      })}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr(
          'الترتيب هو المشهور عند أهل العلم وفي بعضه خلاف. وتُعدّ الآيات التي صُرّح فيها بالاسم أو اللقب (كذي النون وصاحب الحوت)، وقد تُذكر قصة النبي في آيات أخرى دون اسمه.',
          'The order is the well-known one, with some differences among scholars. Verses are those that name him (or a title such as Dhun-Nun); his story may continue in verses without his name.',
        )}
      </Txt>
    </Screen>
  );
}
