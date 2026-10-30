// «ليلة القدر»: the odd nights of Ramadan's last ten with their dates this year, the hadiths, and
// the dua the Prophet ﷺ taught ʿAʾishah for it.
import { router } from 'expo-router';
import { Moon } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, toHijri, type CivilDate } from '@/lib/hijri';
import { oddNightTonight } from '@/lib/seasons-extra';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const QADR_HADITH = 4202; // Whoever stands Laylat al-Qadr in faith and hope… (agreed upon)
const ODD_HADITH = 4540; // Seek it in the odd nights of the last ten (agreed upon)
/** Jamiʿ al-Tirmidhi 3513, from the app's hadith books. */
const DUA = 'اللَّهُمَّ إِنَّكَ عَفُوٌّ كَرِيمٌ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي';

export default function LaylatAlQadr() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const offset = useSettings((s) => s.prayer.hijriOffset);

  // This Ramadan's odd nights (or the next one's), each beginning on the evening of the day before.
  const nights: { night: number; eve: CivilDate }[] = [];
  for (let i = -10; i < 400 && nights.length < 5; i++) {
    const eve = addCivilDays(today, i);
    const night = oddNightTonight(eve, offset);
    if (night) nights.push({ night, eve });
    else if (nights.length && toHijri(addCivilDays(eve, 1), offset).month !== 9) break;
  }
  const tonight = oddNightTonight(today, offset);

  return (
    <Screen title={tr('ليلة القدر', 'Laylat al-Qadr')} subtitle={tr('في الوتر من العشر الأواخر', 'In the odd nights of the last ten')}>
      <Card tone="primary" style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Moon size={20} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {tonight ? tr(`الليلة ليلة ${tonight} — من ليالي الوتر`, `Tonight is night ${tonight} — an odd night`) : tr('دعاؤها', 'Its dua')}
          </Txt>
        </View>
        <Txt color="#FFFFFF" center style={{ fontFamily: t.fonts.reading, fontSize: 22, lineHeight: 40 }}>
          {`«${DUA}»`}
        </Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.85)" style={{ lineHeight: 20 }}>
          {tr(
            'من حديث عائشة رضي الله عنها حين سألت: إن علمتُ أيّ ليلة ليلة القدر ما أقول فيها؟ رواه الترمذي (3513) وقال: حسن صحيح، وصححه أحمد شاكر والألباني، وضعّف إسناده زبير علي زئي.',
            'From ʿAʾishah, who asked what to say if she knew which night it was. al-Tirmidhi (3513), who graded it hasan sahih; also graded sahih by Ahmad Shakir and al-Albani, and weak by Zubair Ali Zai.',
          )}
        </Txt>
        <Txt variant="caption" color={t.colors.highlight} onPress={() => router.push({ pathname: '/hadith/view', params: { book: 'tirmidhi', n: '3513' } })}>
          {tr('الحديث في جامع الترمذي', 'The hadith in Jamiʿ al-Tirmidhi')}
        </Txt>
      </Card>

      {nights.length ? (
        <Card padded={false}>
          {nights.map((n, i) => (
            <View key={civilKey(n.eve)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border, backgroundColor: n.night === tonight && civilKey(n.eve) === civilKey(today) ? t.colors.primarySoft : 'transparent' }}>
              <Txt weight="semibold" style={{ flex: 1 }}>
                {tr(`ليلة ${n.night}`, `Night ${n.night}`)}
              </Txt>
              <Txt variant="caption" muted>
                {tr(`مساء ${f.weekday(n.eve)} ${f.civil(n.eve)}`, `The evening of ${f.weekday(n.eve)} ${f.civil(n.eve)}`)}
              </Txt>
            </View>
          ))}
        </Card>
      ) : null}
      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr('تبدأ الليلة بغروب شمس اليوم الذي قبلها. والتواريخ بحسب التقويم المختار في التطبيق، وقد تختلف بيوم بحسب رؤية الهلال في بلدك.', 'Each night begins at sunset of the day before. Dates follow the calendar chosen in the app and may differ by a day with the moon sighting in your country.')}
      </Txt>
      <Evidence id={ODD_HADITH} full />
      <Evidence id={QADR_HADITH} full />
    </Screen>
  );
}
