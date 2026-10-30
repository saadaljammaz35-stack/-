// «المراجعة السماعية»: the reciter reads a verse and leaves you a pause as long as the verse to
// say it after him — or the pause comes first, for you to recite from memory, and the reciter
// follows so you can check yourself. Works with the screen off in a pocket.
import { useLocalSearchParams } from 'expo-router';
import { Ear, Mic, Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, QuranText, Segmented, SwitchRow, Txt } from '@/components/ui';
import { getSurahs, getSurahVerses, type Surah, type Verse } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { useVerseClip, verseDuration } from '@/features/audio/verse-clip';
import { VersePicker, type VerseRef } from '@/features/quran/verse-picker';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

type Mode = 'repeat' | 'recite';
type Phase = 'listen' | 'you';

const PAUSES = [1, 1.5, 2];
const ROUNDS = [1, 2, 3];

export default function ListeningReview() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ surah?: string; from?: string; to?: string }>();
  const reciterId = useSettings((s) => s.reciterId);
  const main = usePlayer();
  const clip = useVerseClip();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [start, setStart] = useState<VerseRef>({ surah: Number(params.surah) || 67, ayah: Number(params.from) || 1 });
  const [to, setTo] = useState(Number(params.to) || 5);
  const [mode, setMode] = useState<Mode>('repeat');
  const [pause, setPause] = useState(1.5);
  const [rounds, setRounds] = useState(1);
  const [showText, setShowText] = useState(false);
  const [current, setCurrent] = useState<{ ayah: number; phase: Phase; round: number } | null>(null);
  const [error, setError] = useState(false);
  const [bar] = useState(() => new Animated.Value(0));
  const run = useRef(0);
  const timer = useRef<{ id: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  useEffect(() => {
    getSurahVerses(start.surah).then(setVerses);
  }, [start.surah]);
  useEffect(
    () => () => {
      run.current += 1;
      if (timer.current) clearTimeout(timer.current.id);
    },
    [],
  );

  const count = surahs[start.surah - 1]?.versesCount ?? 0;
  const end = Math.min(Math.max(to, start.ayah), count || to);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      bar.setValue(0);
      Animated.timing(bar, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false }).start();
      timer.current = { id: setTimeout(resolve, ms), resolve };
    });

  const stop = () => {
    run.current += 1;
    clip.stop();
    bar.stopAnimation();
    if (timer.current) {
      clearTimeout(timer.current.id);
      timer.current.resolve();
      timer.current = null;
    }
    setCurrent(null);
  };

  const begin = async () => {
    stop();
    main.stop();
    setError(false);
    const token = run.current;
    const alive = () => token === run.current;
    try {
      for (let round = 1; round <= rounds; round++) {
        for (let ayah = start.ayah; ayah <= end; ayah++) {
          const ms = Math.max(1500, (await verseDuration(reciterId, start.surah, ayah)) * pause);
          if (!alive()) return;
          const listen = async () => {
            setCurrent({ ayah, phase: 'listen', round });
            bar.setValue(0);
            return clip.play(reciterId, start.surah, ayah);
          };
          const you = async () => {
            setCurrent({ ayah, phase: 'you', round });
            await wait(ms);
          };
          if (mode === 'repeat') {
            if ((await listen()) === 'stopped' || !alive()) return;
            await you();
          } else {
            await you();
            if (!alive() || (await listen()) === 'stopped') return;
          }
          if (!alive()) return;
        }
      }
      setCurrent(null);
    } catch {
      if (alive()) {
        setError(true);
        setCurrent(null);
      }
    }
  };

  const verse = current ? verses.find((v) => v.ayah === current.ayah) : null;
  const hidden = current?.phase === 'you' && mode === 'recite' && !showText;
  const surahName = surahs[start.surah - 1]?.name ?? '';

  return (
    <Screen title={tr('المراجعة السماعية', 'Listening review')} subtitle={tr('استمع وردّد، أو سمّع ثم تحقّق', 'Listen and repeat, or recite then check')}>
      {current ? (
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {current.phase === 'listen' ? <Ear size={22} color={t.colors.primary} /> : <Mic size={22} color={t.colors.gold} />}
            <Txt variant="subheading" weight="bold" color={current.phase === 'listen' ? t.colors.primaryDeep : t.colors.gold}>
              {current.phase === 'listen' ? (mode === 'repeat' ? tr('استمع', 'Listen') : tr('تحقّق', 'Check')) : mode === 'repeat' ? tr('ردّد', 'Repeat') : tr('اقرأ من حفظك', 'Recite from memory')}
            </Txt>
          </View>
          <Txt muted>{tr(`${surahName} — الآية ${current.ayah}${rounds > 1 ? ` — الجولة ${current.round} من ${rounds}` : ''}`, `${surahName} — verse ${current.ayah}${rounds > 1 ? ` — round ${current.round} of ${rounds}` : ''}`)}</Txt>
          {current.phase === 'you' ? (
            <View style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
              <Animated.View style={{ height: 6, backgroundColor: t.colors.gold, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          ) : null}
          {verse && !hidden ? <QuranText size={24}>{verse.textUthmani}</QuranText> : <Txt muted>{tr('الآية مخفية — اقرأها أنت', 'Verse hidden — recite it yourself')}</Txt>}
          <Button title={tr('إيقاف', 'Stop')} icon={Square} tone="soft" onPress={stop} style={{ alignSelf: 'stretch' }} />
        </Card>
      ) : (
        <>
          <VersePicker surahs={surahs} value={start} onChange={(v) => (setStart(v), setTo((x) => Math.max(x, v.ayah)))} />
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt muted>{tr('حتى الآية', 'To verse')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 2, 4, 9].map((d) => {
                  const n = Math.min(count || start.ayah + d, start.ayah + d);
                  return <Chip key={d} label={String(n)} active={end === n} onPress={() => setTo(n)} />;
                })}
                {count ? <Chip label={tr('آخرها', 'End')} active={end === count} onPress={() => setTo(count)} /> : null}
              </View>
            </View>
          </Card>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'repeat', label: tr('استمع ثم ردّد', 'Listen, then repeat') },
              { value: 'recite', label: tr('سمّع ثم تحقّق', 'Recite, then check') },
            ]}
          />
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt muted>{tr('طول الوقفة', 'Pause length')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PAUSES.map((p) => (
                  <Chip key={p} label={`×${p}`} active={pause === p} onPress={() => setPause(p)} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt muted>{tr('الجولات', 'Rounds')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {ROUNDS.map((r) => (
                  <Chip key={r} label={String(r)} active={rounds === r} onPress={() => setRounds(r)} />
                ))}
              </View>
            </View>
          </Card>
          {mode === 'recite' ? (
            <Card padded={false}>
              <SwitchRow title={tr('أظهر الآية وقت التسميع', 'Show the verse while reciting')} value={showText} onChange={setShowText} />
            </Card>
          ) : null}
          <Button title={tr(`ابدأ: ${surahName} ${start.ayah}–${end}`, `Start: ${surahName} ${start.ayah}–${end}`)} icon={Play} onPress={begin} disabled={!count} />
          <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
            {tr('الوقفة بطول الآية في تلاوة قارئك مضروبًا في ما تختار. ويمكنك إطفاء الشاشة وإبقاء الجوال في جيبك.', 'Each pause is the verse’s length in your reciter’s recitation, times your choice. You can turn the screen off.')}
          </Txt>
        </>
      )}
      {error ? (
        <Txt color={t.colors.danger} center>
          {tr('تعذّر تحميل التلاوة. تحقق من الاتصال أو نزّل السورة.', 'Could not load the recitation. Check your connection or download the surah.')}
        </Txt>
      ) : null}
    </Screen>
  );
}
