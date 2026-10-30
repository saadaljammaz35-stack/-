// «استمع متتابعًا»: the morning or evening adhkar recited one after another, each as many times as
// it is said — hands-free, for the drive or the walk. The current dhikr stays large on screen.
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { Pause, Play, SkipForward } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Loading, ProgressBar, Txt } from '@/components/ui';
import type { DhikrItem } from '@/data/content';
import { useAdhkarList } from '@/features/adhkar/lists';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type Step = { item: DhikrItem; index: number; time: number; of: number };

export default function ListenInSequence() {
  useKeepAwake();
  const t = useTheme();
  const { tr } = useI18n();
  const { id = 'morning' } = useLocalSearchParams<{ id?: string }>();
  const items = useAdhkarList(id);
  const main = usePlayer();
  const [once, setOnce] = useState(false);
  const [pos, setPos] = useState(-1);
  /** The steps of this run, for the screen; the ref serves the audio callback. */
  const [steps, setSteps] = useState<Step[]>([]);
  const playerRef = useRef<AudioPlayer | null>(null);
  const stepsRef = useRef<Step[]>([]);
  const posRef = useRef(-1);

  useEffect(
    () => () => {
      playerRef.current?.remove();
      playerRef.current = null;
    },
    [],
  );

  const build = (list: DhikrItem[]) =>
    list.flatMap((item, index) => {
      if (!item.audio) return [];
      const of = once ? 1 : Math.max(1, Math.min(item.repeat, 100));
      return Array.from({ length: of }, (_, time) => ({ item, index, time, of }));
    });

  const playStep = (next: number) => {
    const steps = stepsRef.current;
    const player = playerRef.current;
    if (!player) return;
    if (next >= steps.length) {
      posRef.current = -1;
      setPos(steps.length);
      return;
    }
    posRef.current = next;
    setPos(next);
    player.replace({ uri: steps[next].item.audio! });
    player.play();
  };

  const start = () => {
    if (!items) return;
    main.stop();
    stepsRef.current = build(items);
    setSteps(stepsRef.current);
    if (!playerRef.current) {
      const p = createAudioPlayer(null);
      p.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (s.didJustFinish && posRef.current >= 0) playStep(posRef.current + 1);
      });
      playerRef.current = p;
    }
    playStep(0);
  };
  const pause = () => {
    playerRef.current?.pause();
    posRef.current = -1;
    setPos(-1);
  };
  const skip = () => {
    const steps = stepsRef.current;
    const cur = posRef.current;
    if (cur < 0) return;
    // Past all the repetitions of the current dhikr.
    let next = cur + 1;
    while (next < steps.length && steps[next].index === steps[cur].index) next += 1;
    playStep(next);
  };

  if (!items) {
    return (
      <Screen title={tr('استمع متتابعًا', 'Listen in sequence')}>
        <Loading />
      </Screen>
    );
  }
  const playing = pos >= 0 && pos < steps.length;
  const finished = pos >= 0 && pos >= steps.length && steps.length > 0;
  const step = playing ? steps[pos] : null;

  return (
    <Screen title={id === 'evening' ? tr('أذكار المساء متتابعة', 'Evening adhkar in sequence') : tr('أذكار الصباح متتابعة', 'Morning adhkar in sequence')} subtitle={tr('استمع وأنت تقود أو تمشي', 'For the drive or the walk')}>
      {!playing ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={tr('بعددها كاملًا', 'With their full counts')} active={!once} onPress={() => setOnce(false)} />
          <Chip label={tr('كل ذكر مرة', 'Each once')} active={once} onPress={() => setOnce(true)} />
        </View>
      ) : null}
      <Card style={{ minHeight: 260, justifyContent: 'center', gap: 12 }}>
        {step ? (
          <>
            <Txt variant="caption" muted center>
              {tr(`الذكر ${step.index + 1} من ${items.length}${step.of > 1 ? ` · المرة ${step.time + 1} من ${step.of}` : ''}`, `Dhikr ${step.index + 1} of ${items.length}${step.of > 1 ? ` · ${step.time + 1} of ${step.of}` : ''}`)}
            </Txt>
            <Txt center style={{ fontFamily: t.fonts.reading, fontSize: t.rs(22), lineHeight: t.rs(42) }} numberOfLines={12}>
              {step.item.text}
            </Txt>
          </>
        ) : (
          <Txt center muted>
            {finished ? tr('تمّت الأذكار، تقبّل الله منك', 'Done — may Allah accept') : tr('تُتلى الأذكار واحدًا بعد الآخر بصوت مسجّل', 'The adhkar are recited one after another')}
          </Txt>
        )}
      </Card>
      {steps.length && pos >= 0 ? <ProgressBar value={Math.min(1, pos / steps.length)} /> : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Button title={playing ? tr('إيقاف مؤقت', 'Pause') : tr('ابدأ', 'Start')} icon={playing ? Pause : Play} style={{ flex: 1 }} onPress={playing ? pause : start} />
        {playing ? <IconButton icon={SkipForward} label={tr('الذكر التالي', 'Next dhikr')} onPress={skip} /> : null}
      </View>
      <Txt variant="caption" muted center>
        {tr('الصوت من موقع حصن المسلم ويحتاج إلى اتصال.', 'Audio from hisnmuslim.com; needs a connection.')}
      </Txt>
    </Screen>
  );
}
