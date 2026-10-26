import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Check, Eye, Headphones, Lightbulb, Pause, Play, RotateCcw, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, IconButton, Loading, ProgressBar, Txt } from '@/components/ui';
import { getSurahs, getSurahVerses, getVerse, type Surah, type Verse } from '@/data/content';
import { usePlayer, usePlayerWord } from '@/features/audio/player';
import { getVerseWords, type VerseWords } from '@/features/hifz/verse-words';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { dueVerses, firstLetterHint, type HifzGrade } from '@/lib/hifz';
import { useSettings } from '@/store/settings';
import { useHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

/** Verses per review session; the rest wait for the next one. */
const REVIEW_LIMIT = 30;

type Stage = 'listen' | 'recall';

export default function HifzSession() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const params = useLocalSearchParams<{ mode?: string; surah?: string; from?: string; to?: string }>();
  const mode = params.mode === 'review' ? 'review' : 'learn';
  const surahNo = Number(params.surah) || 0;
  const from = Number(params.from) || 1;
  const to = Number(params.to) || from;

  const hide = useHifzStore((s) => s.hide);
  const repeat = useHifzStore((s) => s.repeat);
  const gradeVerse = useHifzStore((s) => s.grade);
  const setPlan = useHifzStore((s) => s.setPlan);
  const haptics = useSettings((s) => s.haptics);
  const followWords = useSettings((s) => s.followWords);
  const player = usePlayer();
  const word = usePlayerWord();

  const [queue, setQueue] = useState<Verse[] | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [index, setIndex] = useState(0);
  /** Bumped when a verse is sent back for another listen, so its reveals start over. */
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>(mode === 'review' ? 'recall' : 'listen');
  const [results, setResults] = useState<Record<HifzGrade, number>>({ again: 0, hard: 0, good: 0 });
  const [loaded, setLoaded] = useState<{ id: number; data: VerseWords } | null>(null);
  const [reveal, setReveal] = useState<{ key: string; words: number[]; all: boolean }>({ key: '', words: [], all: false });

  // The review list is fixed when the session opens, so grading does not reshuffle it.
  const [dueIds] = useState(() => dueVerses(useHifzStore.getState().cards, today).slice(0, REVIEW_LIMIT));
  const [dueTotal] = useState(() => dueVerses(useHifzStore.getState().cards, today).length);

  useEffect(() => {
    getSurahs().then(setSurahs);
    (async () => {
      if (mode === 'review') {
        const verses = await Promise.all(dueIds.map((id) => getVerse(id)));
        setQueue(verses.filter((v): v is Verse => Boolean(v)));
      } else if (surahNo) {
        const verses = await getSurahVerses(surahNo);
        setQueue(verses.filter((v) => v.ayah >= from && v.ayah <= to));
      } else {
        setQueue([]);
      }
    })();
  }, [mode, surahNo, from, to, dueIds]);

  const verse = queue?.[index] ?? null;
  const words = verse && loaded?.id === verse.id ? loaded.data : null;
  const stepKey = `${index}:${stage}:${attempt}`;
  const revealed = reveal.key === stepKey ? reveal : { key: stepKey, words: [] as number[], all: false };

  useEffect(() => {
    if (!verse) return;
    let alive = true;
    getVerseWords(verse).then((data) => alive && setLoaded({ id: verse.id, data }));
    return () => {
      alive = false;
    };
  }, [verse]);

  // Keep the latest player in a ref for the play-on-entry effect and the cleanup.
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  });

  const listen = useCallback((v: Verse, times: number) => {
    const p = playerRef.current;
    p.setRepeat({ kind: 'range', from: v.ayah, to: v.ayah, times });
    p.playSurah(v.surah, v.ayah);
  }, []);

  // Play each new verse as it comes up to be learned.
  const played = useRef('');
  useEffect(() => {
    if (!verse || stage !== 'listen') return;
    const key = `${verse.id}:${index}`;
    if (played.current === key) return;
    played.current = key;
    listen(verse, repeat);
  }, [verse, stage, index, repeat, listen]);

  useEffect(
    () => () => {
      const p = playerRef.current;
      p.setRepeat({ kind: 'off' });
      if (p.now?.kind === 'quran') p.stop();
    },
    [],
  );

  const playingThis = Boolean(verse && player.now?.kind === 'quran' && player.now.surah === verse.surah && player.now.ayah === verse.ayah);
  const spokenPosition = useMemo(() => {
    if (!playingThis || !followWords || word == null || !words) return null;
    let best: number | null = null;
    for (const w of words.words) if (w.position <= word && (best == null || w.position > best)) best = w.position;
    return best;
  }, [playingThis, followWords, word, words]);

  const buzz = (strong: boolean) => {
    if (haptics && Platform.OS !== 'web') Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const toRecall = () => {
    playerRef.current.setRepeat({ kind: 'off' });
    if (playerRef.current.playing) playerRef.current.toggle();
    setStage('recall');
  };

  const grade = (g: HifzGrade) => {
    if (!verse || !queue) return;
    buzz(g === 'good');
    gradeVerse(verse.id, g, today);
    setResults((r) => ({ ...r, [g]: r[g] + 1 }));
    if (mode === 'learn' && g === 'again') {
      // Listen again before the next try.
      played.current = '';
      setAttempt((a) => a + 1);
      setStage('listen');
      return;
    }
    if (mode === 'review' && g === 'again' && queue.slice(index + 1).every((v) => v.id !== verse.id)) {
      // A forgotten verse comes round once more before the session ends.
      setQueue([...queue, verse]);
    }
    if (mode === 'learn') setPlan(verse.ayah < to ? { surah: verse.surah, from, to, next: verse.ayah + 1 } : null);
    if (playerRef.current.playing) playerRef.current.toggle();
    setIndex((i) => i + 1);
    setStage(mode === 'review' ? 'recall' : 'listen');
  };

  const title = mode === 'review' ? tr('مراجعة', 'Review') : tr('حفظ', 'Learn');
  if (!queue) {
    return (
      <Screen title={title}>
        <Loading />
      </Screen>
    );
  }
  if (!queue.length) {
    return (
      <Screen title={title}>
        <EmptyState icon={Sparkles} title={tr('لا شيء للمراجعة الآن', 'Nothing to review now')} action={tr('رجوع', 'Back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  if (!verse) {
    const surah = surahs[surahNo - 1];
    const nextFrom = to + 1;
    const hasMore = mode === 'learn' && surah && nextFrom <= surah.versesCount;
    const nextTo = surah ? Math.min(surah.versesCount, nextFrom + (to - from)) : nextFrom;
    return (
      <Screen title={title}>
        <Card tone="soft" style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <Sparkles size={34} color={t.colors.primaryDeep} />
          <Txt variant="title" weight="bold" color={t.colors.primaryDeep} center>
            {tr('بارك الله فيك', 'Well done')}
          </Txt>
          <Txt muted center>
            {mode === 'review'
              ? tr(`راجعت ${index} آية`, `You reviewed ${index} verses`)
              : tr(`حفظت ${queue.length} آيات من سورة ${surah?.name ?? ''}`, `You learned ${queue.length} verses of ${surah?.nameSimple ?? ''}`)}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Txt variant="caption" color={t.colors.success}>{tr(`أتقنتها ${results.good}`, `Solid ${results.good}`)}</Txt>
            <Txt variant="caption" color={t.colors.warning}>{tr(`صعبة ${results.hard}`, `Hard ${results.hard}`)}</Txt>
            <Txt variant="caption" color={t.colors.danger}>{tr(`أعدتها ${results.again}`, `Again ${results.again}`)}</Txt>
          </View>
          {mode === 'review' && dueTotal > queue.length ? (
            <Txt variant="caption" muted center>
              {tr(`بقي ${dueTotal - dueIds.length} آية مستحقة لجلسة أخرى`, `${dueTotal - dueIds.length} more due for another session`)}
            </Txt>
          ) : null}
        </Card>
        {hasMore ? (
          <Button
            title={tr(`المقطع التالي (${nextFrom}–${nextTo})`, `Next passage (${nextFrom}–${nextTo})`)}
            icon={Play}
            onPress={() => {
              setPlan({ surah: surahNo, from: nextFrom, to: nextTo, next: nextFrom });
              router.replace({ pathname: '/hifz/session', params: { mode: 'learn', surah: String(surahNo), from: String(nextFrom), to: String(nextTo) } });
            }}
          />
        ) : null}
        <Button title={tr('رجوع إلى الحفظ', 'Back to Memorise')} tone={hasMore ? 'soft' : 'primary'} onPress={() => router.back()} />
      </Screen>
    );
  }

  const surah = surahs[verse.surah - 1];
  const hidden = stage === 'recall' && !revealed.all;
  const fontSize = t.rs(30);
  const showWord = (i: number) => !hidden || revealed.words.includes(i);
  const revealWord = (i: number) => setReveal({ key: stepKey, words: [...revealed.words, i], all: false });
  const hint = () => {
    if (!words) return;
    const i = words.words.findIndex((_, k) => !revealed.words.includes(k));
    if (i >= 0) revealWord(i);
  };

  return (
    <Screen title={title} subtitle={surah ? tr(`سورة ${surah.name} · الآية ${verse.ayah}`, `${surah.nameSimple} · verse ${verse.ayah}`) : undefined}>
      <View style={{ gap: 6 }}>
        <ProgressBar value={index / queue.length} />
        <Txt variant="caption" muted>
          {tr(`${index + 1} من ${queue.length}`, `${index + 1} of ${queue.length}`)}
        </Txt>
      </View>

      <Card style={{ backgroundColor: t.colors.mushafPaper, paddingVertical: 26, minHeight: 200, justifyContent: 'center' }}>
        {words ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', direction: 'rtl', justifyContent: 'center', columnGap: fontSize * 0.3, rowGap: 6 }}>
            {words.words.map((w, i) => {
              const speaking = stage === 'listen' && w.position === spokenPosition;
              if (showWord(i)) {
                return (
                  <Text
                    key={i}
                    style={{
                      fontFamily: t.fonts.quran,
                      fontSize,
                      lineHeight: fontSize * 1.9,
                      color: speaking ? (t.colors.scheme === 'dark' ? '#F3E6B8' : '#5A3D00') : t.colors.mushafInk,
                      backgroundColor: speaking ? (t.colors.scheme === 'dark' ? '#5A4A1C' : '#F6DE9A') : 'transparent',
                      borderRadius: 6,
                      paddingHorizontal: 2,
                    }}>
                    {w.text}
                  </Text>
                );
              }
              const head = hide === 'first' ? firstLetterHint(w.text) : '';
              const rest = hide === 'first' ? w.text.slice((w.text.match(/^\p{L}\p{M}*/u)?.[0] ?? '').length) : w.text;
              return (
                <Pressable key={i} onPress={() => revealWord(i)} accessibilityLabel={tr('اكشف الكلمة', 'Reveal word')}>
                  <Text
                    style={{
                      fontFamily: t.fonts.quran,
                      fontSize,
                      lineHeight: fontSize * 1.9,
                      backgroundColor: t.colors.primarySoft,
                      borderRadius: 10,
                      paddingHorizontal: 4,
                      color: t.colors.textFaint,
                    }}>
                    {head}
                    <Text style={{ color: 'transparent' }}>{rest}</Text>
                  </Text>
                </Pressable>
              );
            })}
            {words.end ? <Text style={{ fontFamily: t.fonts.quran, fontSize, lineHeight: fontSize * 1.9, color: t.colors.mushafFrame }}>{words.end}</Text> : null}
          </View>
        ) : (
          <Loading />
        )}
      </Card>

      {stage === 'listen' ? (
        <View style={{ gap: 12 }}>
          <Txt muted center>
            {tr(`استمع وتابع الكلمات (${repeat} مرات)، ثم اختبر نفسك`, `Listen and follow the words (${repeat}×), then test yourself`)}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title={playingThis && player.playing ? tr('إيقاف', 'Pause') : tr('استمع', 'Listen')}
              icon={playingThis && player.playing ? Pause : Play}
              tone="soft"
              style={{ flex: 1 }}
              onPress={() => (playingThis && player.playing ? player.toggle() : listen(verse, repeat))}
            />
            <Button title={tr('اختبر نفسك', 'Test me')} icon={ArrowLeftRight} style={{ flex: 1 }} onPress={toRecall} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Txt muted center>
            {hidden ? tr('سمّع الآية من حفظك، والمس أي كلمة لكشفها', 'Recite it from memory; tap any word to reveal it') : tr('كيف كان تسميعك؟', 'How did it go?')}
          </Txt>
          {hidden ? (
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
              <IconButton icon={Lightbulb} label={tr('تلميح: الكلمة التالية', 'Hint: next word')} onPress={hint} />
              <IconButton icon={Headphones} label={tr('استمع', 'Listen')} onPress={() => listen(verse, 1)} />
              <Button title={tr('اكشف الآية', 'Show verse')} icon={Eye} tone="soft" style={{ flex: 1 }} onPress={() => setReveal({ key: stepKey, words: revealed.words, all: true })} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GradeButton label={tr('أعدها', 'Again')} color={t.colors.danger} icon={RotateCcw} onPress={() => grade('again')} />
            <GradeButton label={tr('صعبة', 'Hard')} color={t.colors.warning} icon={Lightbulb} onPress={() => grade('hard')} />
            <GradeButton label={tr('أتقنتها', 'Solid')} color={t.colors.success} icon={Check} onPress={() => grade('good')} />
          </View>
        </View>
      )}
    </Screen>
  );
}

function GradeButton({ label, color, icon: Icon, onPress }: { label: string; color: string; icon: typeof Check; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: color, backgroundColor: t.colors.surface, opacity: pressed ? 0.75 : 1 })}>
      <Icon size={20} color={color} />
      <Txt weight="semibold" color={color}>
        {label}
      </Txt>
    </Pressable>
  );
}
