// «تعلّم»: short, sourced lessons — today's hadith with its explanation and questions, a learning
// path, the Forty Nawawi by heart, the names of Allah, stories, a glossary and Quran games.
import { router } from 'expo-router';
import { BookA, BookOpenCheck, Brain, Gem, GraduationCap, Layers, Puzzle, Route, ScrollText, Sparkles } from 'lucide-react-native';

import { Screen } from '@/components/screen';
import { Card, Group, Row, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { civilKey } from '@/lib/hijri';
import { useLearnStore } from '@/store/user';

export default function Learn() {
  const { tr } = useI18n();
  const today = useToday();
  const done = useLearnStore((s) => s.lessons.includes(civilKey(today)));
  const total = useLearnStore((s) => s.lessons.length);

  return (
    <Screen title={tr('تعلّم', 'Learn')} subtitle={tr('دروس قصيرة من مصادر موثّقة', 'Short lessons from sourced texts')}>
      <Card tone="primary" onPress={() => router.push('/learn/lesson')} style={{ gap: 6 }}>
        <Txt variant="subheading" color="#FFFFFF">
          {done ? tr('أتممت درس اليوم ✓', 'Today’s lesson is done ✓') : tr('درس اليوم: حديث وشرحه في ثلاث دقائق', 'Today: a hadith and its explanation in three minutes')}
        </Txt>
        <Txt color="rgba(255,255,255,0.85)">{tr(`ثم ثلاثة أسئلة على ما قرأت · أتممت ${total} درسًا`, `Then three questions · ${total} lessons done`)}</Txt>
      </Card>
      <Group>
        <Row icon={Route} title={tr('مسار التعلّم', 'Learning path')} subtitle={tr('أركان الإيمان ثم الأخلاق والآداب، حديثًا حديثًا', 'The pillars of faith, then character and manners')} onPress={() => router.push('/learn/path')} />
        <Row icon={Brain} title={tr('الأربعون النووية حفظًا', 'The Forty Nawawi by heart')} subtitle={tr('بالمراجعة المتباعدة', 'With spaced review')} onPress={() => router.push('/learn/nawawi')} />
        <Row icon={Gem} title={tr('اختبار أسماء الله الحسنى', 'Names of Allah quiz')} subtitle={tr('من شرح الخطابي', 'From al-Khattabi’s explanation')} onPress={() => router.push('/learn/names-quiz')} />
        <Row icon={ScrollText} title={tr('قصص من الحديث الصحيح', 'Stories from authentic hadith')} onPress={() => router.push('/learn/stories')} />
        <Row icon={BookA} title={tr('قاموس ألفاظ الحديث', 'Hadith glossary')} subtitle={tr('معاني الكلمات من موسوعة الأحاديث', 'Word meanings from the Hadith Encyclopedia')} onPress={() => router.push('/learn/glossary')} />
        <Row icon={Sparkles} title={tr('حِكم العبادات من القرآن', 'The wisdom of worship, from the Quran')} onPress={() => router.push('/learn/wisdom')} />
      </Group>
      <Group>
        <Row icon={Puzzle} title={tr('رتّب الآيات وأكمل الآية', 'Order the verses, complete the verse')} subtitle={tr('من محفوظك أو من قصار السور', 'From what you know or the short surahs')} onPress={() => router.push('/learn/verses')} />
        <Row icon={Layers} title={tr('بطاقات أذكار الصغار', 'Kids’ adhkar cards')} onPress={() => router.push('/learn/kids-cards')} />
        <Row icon={GraduationCap} title={tr('حفظ الأذكار', 'Learn the adhkar by heart')} onPress={() => router.push('/adhkar/memorize')} />
        <Row icon={BookOpenCheck} title={tr('حفظ الصغار', 'Kids’ hifz')} onPress={() => router.push('/kids')} />
      </Group>
      <Txt variant="caption" muted center>
        {tr('كل سؤال مبني على نص موثّق في التطبيق نفسه.', 'Every question is built from a sourced text in the app.')}
      </Txt>
    </Screen>
  );
}
