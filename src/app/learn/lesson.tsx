// «درس اليوم»: one hadith with its explanation, benefits and word meanings (HadeethEnc), then three
// questions on the meanings of its words.
import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, Loading, Txt } from '@/components/ui';
import { getDailyHadith, getMeaningPool, type EncHadith } from '@/data/content';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { civilKey } from '@/lib/hijri';
import { meaningQuestions, seeded } from '@/lib/quiz';
import { useLearnStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function Lesson() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const finish = useLearnStore((s) => s.finishLesson);
  const finished = useLearnStore((s) => s.lessons.includes(civilKey(today)));
  const [h, setH] = useState<EncHadith | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [stage, setStage] = useState<'read' | 'quiz'>('read');

  useEffect(() => {
    getDailyHadith(today).then(setH);
    getMeaningPool().then(setPool);
  }, [today]);

  const seed = today.year * 10000 + today.month * 100 + today.day;
  const questions = useMemo(() => (h && pool.length ? meaningQuestions(h.meanings, pool, seeded(seed)) : []), [h, pool, seed]);
  const right = questions.filter((q, i) => answers[i] === q.answer).length;
  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i] != null);

  if (!h) {
    return (
      <Screen title={tr('درس اليوم', 'Today’s lesson')}>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen title={tr('درس اليوم', 'Today’s lesson')} subtitle={h.title}>
      {stage === 'read' ? (
        <>
          <Card style={{ gap: 10 }}>
            <Txt style={{ fontFamily: t.fonts.reading, fontSize: t.rs(19), lineHeight: t.rs(36) }}>{h.text}</Txt>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={h.attribution.split('\n')[0]} />
              <Badge label={h.grade.split('\n')[0]} tone="sahih" />
            </View>
          </Card>
          <Card style={{ gap: 8 }}>
            <Txt weight="semibold">{tr('الشرح', 'Explanation')}</Txt>
            <Txt style={{ lineHeight: 26 }}>{h.explanation}</Txt>
          </Card>
          {h.hints.length ? (
            <Card style={{ gap: 6 }}>
              <Txt weight="semibold">{tr('من فوائده', 'Lessons from it')}</Txt>
              {h.hints.map((x, i) => (
                <Txt key={i} style={{ lineHeight: 24 }}>{`• ${x}`}</Txt>
              ))}
            </Card>
          ) : null}
          <Txt variant="caption" muted center>
            {tr('من موسوعة الأحاديث النبوية (HadeethEnc.com)', 'From the Encyclopedia of Prophetic Hadiths (HadeethEnc.com)')}
          </Txt>
          {questions.length ? <Button title={tr('إلى الأسئلة', 'To the questions')} onPress={() => setStage('quiz')} /> : <Button title={finished ? tr('أتممته ✓', 'Done ✓') : tr('أتممت الدرس', 'I finished the lesson')} onPress={() => finish(today)} />}
        </>
      ) : (
        <>
          {questions.map((q, i) => (
            <Card key={q.word} style={{ gap: 10 }}>
              <Txt weight="semibold">{tr(`ما معنى «${q.word}» في الحديث؟`, `What does “${q.word}” mean in the hadith?`)}</Txt>
              {q.options.map((o) => {
                const chosen = answers[i] === o;
                const show = answers[i] != null;
                const correct = o === q.answer;
                return (
                  <Pressable
                    key={o}
                    disabled={show}
                    onPress={() => setAnswers((a) => ({ ...a, [i]: o }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: show && correct ? t.colors.success : chosen ? t.colors.danger : t.colors.border, backgroundColor: show && correct ? t.colors.primarySoft : t.colors.surface }}>
                    <Txt style={{ flex: 1, lineHeight: 22 }}>{o}</Txt>
                    {show && correct ? <Check size={18} color={t.colors.success} /> : chosen ? <X size={18} color={t.colors.danger} /> : null}
                  </Pressable>
                );
              })}
            </Card>
          ))}
          {allAnswered ? (
            <Card tone="primary" style={{ gap: 8, alignItems: 'center' }}>
              <Txt variant="title" color="#FFFFFF">
                {tr(`${right} من ${questions.length}`, `${right} of ${questions.length}`)}
              </Txt>
              <Button title={finished ? tr('أتممته ✓', 'Done ✓') : tr('أتممت درس اليوم', 'Finish today’s lesson')} tone="soft" onPress={() => (finish(today), router.back())} />
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
