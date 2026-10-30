// «علامات المصحف»: what the small marks in the Madani mushaf mean — the pause (waqf) marks, the
// prostration mark and the hizb mark — as explained at the end of the King Fahd Complex print.
// Only marks that occur in this app's text are listed.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { getSajdaVerses, getSurahs, type Surah, type Verse } from '@/data/content';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const MARKS: { mark: string; ar: string; en: string; spacing?: boolean }[] = [
  { mark: 'ۘ', ar: 'علامة الوقف اللازم: يلزم الوقف عندها.', en: 'Required stop.' },
  { mark: 'ۚ', ar: 'علامة الوقف الجائز جوازًا مستوي الطرفين: الوقف والوصل سواء.', en: 'Stopping and continuing are equal.' },
  { mark: 'ۖ', ar: 'علامة الوقف الجائز مع كون الوصل أولى.', en: 'Stopping is allowed; continuing is better.' },
  { mark: 'ۗ', ar: 'علامة الوقف الجائز مع كون الوقف أولى.', en: 'Continuing is allowed; stopping is better.' },
  { mark: 'ۛ', ar: 'علامة تعانق الوقف: إذا وُقف على أحد الموضعين لم يصح الوقف على الآخر.', en: 'Paired marks: stop at one of the two places, not both.' },
  { mark: 'ۜ', ar: 'علامة السكت في آخر الكلمة: سكتة يسيرة من غير تنفّس عند وصلها بما بعدها.', en: 'A brief pause without taking breath, when joining with what follows.' },
  { mark: '۩', ar: 'علامة موضع السجدة (سجود التلاوة).', en: 'Place of prostration of recitation.', spacing: true },
  { mark: '۞', ar: 'علامة بداية الأجزاء والأحزاب وأنصافها وأرباعها.', en: 'Start of a juz, hizb, or its half or quarter.', spacing: true },
];

export default function MushafMarks() {
  const t = useTheme();
  const { tr } = useI18n();
  const [sajdas, setSajdas] = useState<Verse[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getSajdaVerses().then(setSajdas);
    getSurahs().then(setSurahs);
  }, []);

  const open = (v: Verse) => {
    useMushafNav.getState().go(v.page, v.id);
    router.push({ pathname: '/mushaf', params: { page: String(v.page), verse: String(v.id) } });
  };

  return (
    <Screen title={tr('علامات المصحف', 'Mushaf marks')} subtitle={tr('معاني علامات الوقف وغيرها', 'Pause marks and others')}>
      <Card padded={false}>
        {MARKS.map((m, i) => (
          <View key={m.mark} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: t.colors.mushafPaper, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {/* The pause marks sit above a letter, so they are shown over a tatweel as in the text. */}
              <Text style={{ fontFamily: t.fonts.quran, fontSize: m.spacing ? 34 : 44, lineHeight: m.spacing ? 50 : 96, color: t.colors.mushafFrame, includeFontPadding: false, transform: m.spacing ? [] : [{ translateY: -2 }] }}>
                {m.spacing ? m.mark : `ـ${m.mark}ـ`}
              </Text>
            </View>
            <Txt style={{ flex: 1, lineHeight: 24 }}>{tr(m.ar, m.en)}</Txt>
          </View>
        ))}
      </Card>
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('من «التعريف بهذا المصحف» في آخر مصحف المدينة النبوية، طبعة مجمع الملك فهد لطباعة المصحف الشريف.', 'From the notes at the end of the Madinah mushaf printed by the King Fahd Complex.')}
      </Txt>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr(`مواضع السجدة في هذا المصحف (${sajdas.length})`, `Places of prostration in this mushaf (${sajdas.length})`)}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sajdas.map((v) => (
            <Txt key={v.id} variant="caption" onPress={() => open(v)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.primarySoft, color: t.colors.primaryDeep }}>
              {`${surahs[v.surah - 1]?.name ?? ''} ${v.ayah}`}
            </Txt>
          ))}
        </View>
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr(
            'اختلف الفقهاء في عدد سجدات التلاوة، ومنها سجدة «ص» والسجدة الثانية في «الحج»: فمنهم من يعدّها أربع عشرة ومنهم من يعدّها خمس عشرة. ينظر: «المغني» لابن قدامة، باب سجود التلاوة.',
            'Jurists differ on the number of prostrations of recitation — notably the one in Sad and the second in al-Hajj — counting fourteen or fifteen. See Ibn Qudamah, al-Mughni, chapter on the prostration of recitation.',
          )}
        </Txt>
        <Button title={tr('دعاء سجود التلاوة', 'Dua of the prostration of recitation')} tone="soft" onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: 'hisn:21' } })} />
      </Card>
    </Screen>
  );
}
