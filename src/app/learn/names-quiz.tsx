// «اختبار الأسماء الحسنى»: al-Khattabi's explanation with the name hidden — which name is it?
import { router } from 'expo-router';
import { Check, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Loading, Txt } from '@/components/ui';
import { getNames, type NameOfAllah } from '@/data/content';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { choices, nameClue, seeded, shuffle } from '@/lib/quiz';
import { useTheme } from '@/theme';

const ROUND = 5;

export default function NamesQuiz() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const [names, setNames] = useState<NameOfAllah[] | null>(null);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Only names whose explanation still says something once the name is hidden.
    getNames().then((l) => setNames(l.filter((n) => nameClue(n.name, n.explanation).replace(/…/g, '').trim().length > 50)));
  }, []);

  const questions = useMemo(() => {
    if (!names) return [];
    const rand = seeded(today.year * 10000 + today.month * 100 + today.day + round * 7919);
    const pool = names.map((n) => n.name);
    return shuffle(names, rand)
      .slice(0, ROUND)
      .map((n) => ({ n: n.n, answer: n.name, clue: nameClue(n.name, n.explanation), options: choices(n.name, pool, 4, rand) }));
  }, [names, today, round]);

  if (!names) {
    return (
      <Screen title={tr('اختبار الأسماء الحسنى', 'Names of Allah quiz')}>
        <Loading />
      </Screen>
    );
  }
  const q = questions[index];
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };
  const again = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setScore(0);
    setPicked(null);
  };

  return (
    <Screen title={tr('اختبار الأسماء الحسنى', 'Names of Allah quiz')} subtitle={tr('من «شأن الدعاء» للخطابي', 'From al-Khattabi’s Sha’n al-Du‘a’')}>
      {q ? (
        <>
          <Txt variant="caption" muted center>
            {tr(`السؤال ${index + 1} من ${ROUND}`, `Question ${index + 1} of ${ROUND}`)}
          </Txt>
          <Card style={{ gap: 8 }}>
            <Txt weight="semibold">{tr('أيّ اسم يشرحه هذا الكلام؟', 'Which name does this explain?')}</Txt>
            <Txt style={{ fontFamily: t.fonts.reading, fontSize: t.rs(18), lineHeight: t.rs(34) }}>{q.clue}</Txt>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {q.options.map((o) => {
              const show = picked != null;
              const correct = o === q.answer;
              return (
                <Pressable
                  key={o}
                  disabled={show}
                  onPress={() => {
                    setPicked(o);
                    if (correct) setScore((s) => s + 1);
                  }}
                  style={{ width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: show && correct ? t.colors.success : picked === o ? t.colors.danger : t.colors.border, backgroundColor: show && correct ? t.colors.primarySoft : t.colors.surface }}>
                  <Txt style={{ fontFamily: t.fonts.readingBold, fontSize: 22, lineHeight: 34 }}>{o}</Txt>
                  {show && correct ? <Check size={16} color={t.colors.success} /> : picked === o ? <X size={16} color={t.colors.danger} /> : null}
                </Pressable>
              );
            })}
          </View>
          {picked ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={tr('الشرح كاملًا', 'Full explanation')} tone="soft" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/names/[n]', params: { n: String(q.n) } })} />
              <Button title={index + 1 < ROUND ? tr('التالي', 'Next') : tr('النتيجة', 'Result')} style={{ flex: 1 }} onPress={next} />
            </View>
          ) : null}
        </>
      ) : (
        <Card tone="primary" style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <Txt variant="title" color="#FFFFFF">
            {tr(`${score} من ${ROUND}`, `${score} of ${ROUND}`)}
          </Txt>
          <Button title={tr('جولة أخرى', 'Another round')} icon={RotateCcw} tone="soft" onPress={again} />
        </Card>
      )}
    </Screen>
  );
}
