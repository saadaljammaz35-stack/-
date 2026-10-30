// «الأربعون النووية حفظًا»: the hadiths of al-Nawawi's Forty as cards on the spaced schedule: recall
// it from its opening words, reveal, and grade.
import { router } from 'expo-router';
import { Brain, Check, Eye, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Loading, Txt } from '@/components/ui';
import { ensureBundledBooks, getHadith, type Hadith } from '@/features/hadith/books';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { dueKeys, type HifzGrade } from '@/lib/hifz';
import { useAdhkarHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

const COUNT = 42;
const keyOf = (n: number) => `nawawi:${n}`;

/** The Prophet's words: what follows «صلى الله عليه و سلم … :» up to the attribution, else the text. */
function matn(text: string): string {
  const body = text.split(/\[?رَوَاهُ|حَدِيثٌ (?:حَسَنٌ|صَحِيحٌ)/)[0];
  const quoted = body.match(/["«“]([^"»”]{12,})["»”]/);
  if (quoted) return quoted[1].trim();
  // The last mention, since the chain may mention him first (e.g. «سبط رسول الله ﷺ»).
  const at = Math.max(body.lastIndexOf('صلى الله عليه و سلم'), body.lastIndexOf('صلى الله عليه وسلم'));
  if (at >= 0) {
    const after = body.slice(at).replace(/^صلى الله عليه و ?سلم/, '');
    const colon = after.indexOf(':');
    const words = colon >= 0 && colon < 60 ? after.slice(colon + 1) : after;
    if (words.trim().length > 12) return words.replace(/^[\s:\-–]+/, '').trim();
  }
  return body.replace(/^[^:]{0,160}:\s*/, '').trim();
}

export default function NawawiByHeart() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const cards = useAdhkarHifzStore((s) => s.cards);
  const grade = useAdhkarHifzStore((s) => s.grade);
  const forget = useAdhkarHifzStore((s) => s.forget);
  const [hadiths, setHadiths] = useState<Hadith[] | null>(null);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureBundledBooks().catch(() => undefined);
      const list: Hadith[] = [];
      for (let n = 1; n <= COUNT; n++) {
        const h = await getHadith('nawawi', n);
        if (h) list.push(h);
      }
      setHadiths(list);
    })();
  }, []);

  const mine = useMemo(() => Object.fromEntries(Object.entries(cards).filter(([k]) => k.startsWith('nawawi:'))), [cards]);
  const due = useMemo(() => dueKeys(mine, today), [mine, today]);
  if (!hadiths) {
    return (
      <Screen title={tr('الأربعون النووية حفظًا', 'The Forty by heart')}>
        <Loading />
      </Screen>
    );
  }
  const byKey = new Map(hadiths.map((h) => [keyOf(h.n), h]));

  if (queue) {
    const current = queue[0] ? byKey.get(queue[0]) : undefined;
    const rate = (g: HifzGrade) => {
      grade(queue[0], g, today);
      setShown(false);
      setQueue(queue.slice(1));
    };
    return (
      <Screen title={tr('مراجعة الأربعين', 'Review the Forty')} subtitle={tr(`بقي ${queue.length}`, `${queue.length} left`)}>
        {current ? (
          <>
            <Card style={{ gap: 10, minHeight: 200, justifyContent: 'center' }}>
              <Txt variant="caption" muted center>
                {tr(`الحديث ${current.n}`, `Hadith ${current.n}`)}
              </Txt>
              <Txt center style={{ fontFamily: t.fonts.reading, fontSize: t.rs(19), lineHeight: t.rs(36) }}>
                {shown ? matn(current.text) : `${matn(current.text).split(/\s+/).slice(0, 4).join(' ')} …`}
              </Txt>
            </Card>
            {shown ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={tr('أخطأت', 'Missed')} tone="danger" style={{ flex: 1 }} onPress={() => rate('again')} />
                <Button title={tr('بصعوبة', 'Hard')} tone="soft" style={{ flex: 1 }} onPress={() => rate('hard')} />
                <Button title={tr('أتقنته', 'Got it')} style={{ flex: 1 }} onPress={() => rate('good')} />
              </View>
            ) : (
              <Button title={tr('قلته من حفظي، أظهره', 'I said it — show it')} icon={Eye} onPress={() => setShown(true)} />
            )}
          </>
        ) : (
          <Card tone="primary" style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
            <Check size={32} color={t.colors.highlight} />
            <Txt variant="subheading" color="#FFFFFF">
              {tr('أنهيت مراجعة اليوم', 'Today’s review is done')}
            </Txt>
            <Button title={tr('رجوع', 'Back')} tone="soft" onPress={() => setQueue(null)} />
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen title={tr('الأربعون النووية حفظًا', 'The Forty by heart')} subtitle={tr(`تحفظ ${Object.keys(mine).length} من ${hadiths.length}`, `Learning ${Object.keys(mine).length} of ${hadiths.length}`)}>
      <Card tone="primary" style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Brain size={22} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {due.length ? tr(`${due.length} للمراجعة اليوم`, `${due.length} due today`) : tr('اختر الأحاديث التي تحفظها', 'Choose the hadiths to learn')}
          </Txt>
        </View>
        {due.length ? <Button title={tr('ابدأ المراجعة', 'Start the review')} tone="soft" onPress={() => setQueue(due)} /> : null}
      </Card>
      <Card padded={false}>
        {hadiths.map((h, i) => {
          const on = Boolean(mine[keyOf(h.n)]);
          return (
            <View key={h.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <Txt muted style={{ width: 26 }}>
                {h.n}
              </Txt>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/hadith/view', params: { book: 'nawawi', n: String(h.n) } })}>
                <Txt numberOfLines={2} style={{ lineHeight: 22 }}>
                  {matn(h.text)}
                </Txt>
              </Pressable>
              <Pressable onPress={() => (on ? forget(keyOf(h.n)) : grade(keyOf(h.n), 'again', today))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} hitSlop={8}>
                {on ? <Check size={20} color={t.colors.primary} /> : <Plus size={20} color={t.colors.textFaint} />}
              </Pressable>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
