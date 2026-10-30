// «رتّب الآيات وأكمل الآية»: two games on a surah — put a passage's verses back in order, and pick the
// words that end a verse. From the short surahs, or from any surah you choose.
import { Check, RotateCcw, Shuffle, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, Loading, QuranText, Txt } from '@/components/ui';
import { getSurahs, getSurahVerses, type Surah, type Verse } from '@/data/content';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { KIDS_SURAHS } from '@/lib/kids';
import { completeVerse, seeded, shuffle } from '@/lib/quiz';
import { useTheme } from '@/theme';

type Game = 'order' | 'complete';

function OrderGame({ verses, seed }: { verses: Verse[]; seed: number }) {
  const t = useTheme();
  const { tr } = useI18n();
  const rand = seeded(seed);
  const start = verses.length > 5 ? Math.floor(rand() * (verses.length - 4)) : 0;
  const passage = verses.slice(start, start + 5);
  const [order] = useState(() => shuffle(passage, rand));
  const [placed, setPlaced] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const done = placed.length === passage.length;

  const pick = (v: Verse) => {
    if (placed.includes(v.id)) return;
    if (v.id === passage[placed.length].id) {
      setPlaced((p) => [...p, v.id]);
      setWrong(null);
    } else setWrong(v.id);
  };

  return (
    <View style={{ gap: 10 }}>
      <Txt muted>{done ? tr('أحسنت! رتّبتها كلها', 'Well done — all in order') : tr(`المس الآية التي تأتي برقم ${placed.length + 1}`, `Tap verse number ${placed.length + 1}`)}</Txt>
      {order.map((v) => {
        const at = placed.indexOf(v.id);
        return (
          <Pressable
            key={v.id}
            onPress={() => pick(v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: at >= 0 ? t.colors.success : wrong === v.id ? t.colors.danger : t.colors.border, backgroundColor: at >= 0 ? t.colors.primarySoft : t.colors.surface }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: at >= 0 ? t.colors.fill : t.colors.surfaceAlt }}>
              {at >= 0 ? <Txt weight="bold" color="#FFFFFF">{at + 1}</Txt> : wrong === v.id ? <X size={14} color={t.colors.danger} /> : null}
            </View>
            <QuranText size={20} style={{ flex: 1, textAlign: 'right' }}>
              {v.textQpc}
            </QuranText>
          </Pressable>
        );
      })}
    </View>
  );
}

function CompleteGame({ verses, seed }: { verses: Verse[]; seed: number }) {
  const t = useTheme();
  const { tr } = useI18n();
  const rand = seeded(seed);
  const candidates = verses.filter((v) => v.textQpc.split(' ').length >= 4);
  const v = candidates[Math.floor(rand() * candidates.length)];
  const endings = verses.filter((x) => x.id !== v?.id).map((x) => x.textQpc.split(' ').slice(-2).join(' '));
  const q = useMemo(() => (v ? completeVerse(v.textQpc.split(' '), endings, rand) : null), [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<string | null>(null);
  if (!v || !q) return <Txt muted>{tr('السورة قصيرة جدًا لهذه اللعبة.', 'This surah is too short for this game.')}</Txt>;

  return (
    <View style={{ gap: 10 }}>
      <Card style={{ gap: 6 }}>
        <QuranText size={22}>{`${q.shown} ${picked ? (picked === q.answer ? q.answer : '…') : '…'} ${toArabicDigits(v.ayah)}`}</QuranText>
      </Card>
      {q.options.map((o) => {
        const show = picked != null;
        const correct = o === q.answer;
        return (
          <Pressable
            key={o}
            disabled={show}
            onPress={() => setPicked(o)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: show && correct ? t.colors.success : picked === o ? t.colors.danger : t.colors.border, backgroundColor: show && correct ? t.colors.primarySoft : t.colors.surface }}>
            <QuranText size={20} style={{ flex: 1 }}>
              {o}
            </QuranText>
            {show && correct ? <Check size={18} color={t.colors.success} /> : picked === o ? <X size={18} color={t.colors.danger} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function VerseGames() {
  const { tr } = useI18n();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surah, setSurah] = useState(78);
  const [loaded, setLoaded] = useState<{ surah: number; verses: Verse[] } | null>(null);
  const [game, setGame] = useState<Game>('order');
  const [round, setRound] = useState(1);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  useEffect(() => {
    let alive = true;
    getSurahVerses(surah).then((v) => alive && setLoaded({ surah, verses: v }));
    return () => {
      alive = false;
    };
  }, [surah]);
  const verses = loaded?.surah === surah ? loaded.verses : null;

  // Juz ʿAmma, then a few well-known longer surahs.
  const options = [...new Set([...KIDS_SURAHS.filter((n) => n !== 1), 67, 36, 18])].map((n) => surahs[n - 1]).filter(Boolean);

  return (
    <Screen title={tr('ألعاب الآيات', 'Verse games')} subtitle={tr('رتّب الآيات، وأكمل الآية', 'Order the verses, complete the verse')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={tr('رتّب الآيات', 'Order')} active={game === 'order'} onPress={() => setGame('order')} />
        <Chip label={tr('أكمل الآية', 'Complete')} active={game === 'complete'} onPress={() => setGame('complete')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((s) => (
          <Chip key={s.id} label={s.name} active={surah === s.id} onPress={() => (setSurah(s.id), setRound((r) => r + 1))} />
        ))}
      </View>
      {!verses ? <Loading /> : game === 'order' ? <OrderGame key={`o-${surah}-${round}`} verses={verses} seed={surah * 131 + round} /> : <CompleteGame key={`c-${surah}-${round}`} verses={verses} seed={surah * 977 + round} />}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title={tr('جولة جديدة', 'New round')} icon={Shuffle} tone="soft" style={{ flex: 1 }} onPress={() => setRound((r) => r + 1)} />
        <Button title={tr('من البداية', 'Restart')} icon={RotateCcw} tone="plain" onPress={() => setRound(1)} />
      </View>
    </Screen>
  );
}
