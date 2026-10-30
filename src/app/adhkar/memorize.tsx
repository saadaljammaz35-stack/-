// «حفظ الأذكار»: learn the morning and evening adhkar by heart. Each one chosen becomes a card on the
// same spaced schedule as memorised verses: recite it from its opening words, then reveal and grade.
import { Brain, Check, Eye, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, Loading, Txt } from '@/components/ui';
import { getDhikrByKey, type DhikrItem } from '@/data/content';
import { useAdhkarList } from '@/features/adhkar/lists';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { dueKeys, type HifzGrade } from '@/lib/hifz';
import { useAdhkarHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

/** The opening words, the rest hidden. */
const opening = (text: string, words = 3) => text.split(/\s+/).slice(0, words).join(' ') + ' …';

function Review({ keys, onDone }: { keys: string[]; onDone: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const grade = useAdhkarHifzStore((s) => s.grade);
  const [index, setIndex] = useState(0);
  const [item, setItem] = useState<DhikrItem | null>(null);
  const [shown, setShown] = useState(false);
  const key = keys[index];

  useEffect(() => {
    let alive = true;
    if (key) getDhikrByKey(key).then((x) => alive && (setItem(x), setShown(false)));
    return () => {
      alive = false;
    };
  }, [key]);

  if (!key) {
    return (
      <Card tone="primary" style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
        <Check size={32} color={t.colors.highlight} />
        <Txt variant="subheading" color="#FFFFFF">
          {tr('أنهيت مراجعة اليوم', 'Today’s review is done')}
        </Txt>
        <Button title={tr('رجوع', 'Back')} tone="soft" onPress={onDone} />
      </Card>
    );
  }
  if (!item) return <Loading />;
  const rate = (g: HifzGrade) => {
    grade(key, g, today);
    setIndex((i) => i + 1);
  };

  return (
    <View style={{ gap: 12 }}>
      <Txt variant="caption" muted center>
        {tr(`${index + 1} من ${keys.length}`, `${index + 1} of ${keys.length}`)}
      </Txt>
      <Card style={{ gap: 10, minHeight: 180, justifyContent: 'center' }}>
        <Txt center style={{ fontFamily: t.fonts.reading, fontSize: t.rs(20), lineHeight: t.rs(38) }}>
          {shown ? item.text : opening(item.text)}
        </Txt>
        {shown ? (
          <Txt variant="caption" muted center>
            {item.reference.split('\n')[0]}
          </Txt>
        ) : null}
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
    </View>
  );
}

export default function MemorizeAdhkar() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const cards = useAdhkarHifzStore((s) => s.cards);
  const grade = useAdhkarHifzStore((s) => s.grade);
  const forget = useAdhkarHifzStore((s) => s.forget);
  const [list, setList] = useState<'morning' | 'evening'>('morning');
  const items = useAdhkarList(list);
  const [reviewing, setReviewing] = useState<string[] | null>(null);
  const due = useMemo(() => dueKeys(cards, today), [cards, today]);
  const learning = Object.keys(cards).length;

  if (reviewing) {
    return (
      <Screen title={tr('حفظ الأذكار', 'Learn the adhkar')}>
        <Review keys={reviewing} onDone={() => setReviewing(null)} />
      </Screen>
    );
  }

  return (
    <Screen title={tr('حفظ الأذكار', 'Learn the adhkar')} subtitle={tr('تحفظها لتقولها من قلبك بلا جوال', 'By heart, to say them without the phone')}>
      <Card tone="primary" style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Brain size={22} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {learning ? tr(`تحفظ ${learning} ذكرًا · ${due.length} للمراجعة اليوم`, `Learning ${learning} · ${due.length} due today`) : tr('اختر ما تريد حفظه', 'Choose what to learn')}
          </Txt>
        </View>
        {due.length ? <Button title={tr('ابدأ المراجعة', 'Start the review')} tone="soft" onPress={() => setReviewing(due)} /> : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={tr('أذكار الصباح', 'Morning')} active={list === 'morning'} onPress={() => setList('morning')} />
        <Chip label={tr('أذكار المساء', 'Evening')} active={list === 'evening'} onPress={() => setList('evening')} />
      </View>
      {!items ? (
        <Loading />
      ) : items.length ? (
        <Card padded={false}>
          {items.map((it, i) => {
            const on = Boolean(cards[it.key]);
            return (
              <Pressable
                key={it.key}
                onPress={() => (on ? forget(it.key) : grade(it.key, 'again', today))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
                <Txt numberOfLines={2} style={{ flex: 1, lineHeight: 24 }}>
                  {it.text}
                </Txt>
                {on ? <Check size={20} color={t.colors.primary} /> : <Plus size={20} color={t.colors.textFaint} />}
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={Brain} title={tr('لا أذكار هنا', 'Nothing here')} />
      )}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('كل ذكر تختاره يعود إليك غدًا، ثم بعد أيام أطول كلما أتقنته.', 'Each one you choose comes back tomorrow, then after longer gaps as you master it.')}
      </Txt>
    </Screen>
  );
}
