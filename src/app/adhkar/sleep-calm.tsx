// «أذكار النوم الهادئة»: the sleep adhkar of Hisn al-Muslim recited one after another on a dark
// screen, each as many times as it is said, the voice growing softer until the last.
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { router } from 'expo-router';
import { Moon, Play, Square, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Tap, Txt } from '@/components/ui';
import { getHisnChapterItems, type DhikrItem } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const SLEEP_CHAPTER = 28;
const BG = '#05070A';
/** Volume at the start and at the last recitation. */
const LOUD = 1;
const SOFT = 0.25;

type Step = { item: DhikrItem; index: number; time: number; of: number };

export default function CalmSleep() {
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const main = usePlayer();
  const [items, setItems] = useState<DhikrItem[]>([]);
  const [current, setCurrent] = useState(-1);
  const [done, setDone] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const stepsRef = useRef<Step[]>([]);
  const posRef = useRef(-1);

  useEffect(() => {
    getHisnChapterItems(SLEEP_CHAPTER).then((list) => {
      setItems(list);
      // Each dhikr as many times as it is said (the three Quls three times, and so on).
      stepsRef.current = list.flatMap((item, index) => (item.audio ? Array.from({ length: Math.max(1, item.repeat) }, (_, time) => ({ item, index, time, of: Math.max(1, item.repeat) })) : []));
    });
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const playStep = (pos: number) => {
    const steps = stepsRef.current;
    const player = playerRef.current;
    if (!player) return;
    if (pos >= steps.length) {
      posRef.current = -1;
      setCurrent(-1);
      setDone(true);
      return;
    }
    posRef.current = pos;
    setCurrent(steps[pos].index);
    player.replace({ uri: steps[pos].item.audio! });
    player.volume = LOUD - ((LOUD - SOFT) * pos) / Math.max(1, steps.length - 1);
    player.play();
  };

  const start = () => {
    main.stop();
    if (!playerRef.current) {
      const p = createAudioPlayer(null);
      p.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (s.didJustFinish && posRef.current >= 0) playStep(posRef.current + 1);
      });
      playerRef.current = p;
    }
    setDone(false);
    playStep(0);
  };

  const stop = () => {
    playerRef.current?.pause();
    posRef.current = -1;
    setCurrent(-1);
  };

  const playing = current >= 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
        <IconButton icon={X} label={tr('إغلاق', 'Close')} tone="plain" color="#7C8590" onPress={() => (stop(), router.back())} />
        <Txt weight="semibold" color="#7C8590" style={{ flex: 1 }}>
          {tr('أذكار النوم', 'Sleep adhkar')}
        </Txt>
        <Moon size={18} color="#4E5A66" />
      </View>
      {done ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 }}>
          <Moon size={40} color="#3A4450" />
          <Txt color="#4E5A66" center style={{ lineHeight: 28 }}>
            {tr('تصبح على خير. باسمك اللهم أموت وأحيا.', 'Good night.')}
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 140 }}>
          <Txt color="#5A6470" center style={{ lineHeight: 24 }}>
            {tr('استلقِ على شقك الأيمن، وردّد مع القارئ. يخفت الصوت شيئًا فشيئًا حتى ينتهي.', 'Lie on your right side and repeat with the reciter. The voice softens little by little until the end.')}
          </Txt>
          {items.map((item, i) => (
            <Tap key={item.key} onPress={() => playing && playStep(stepsRef.current.findIndex((s) => s.index === i))} style={{ opacity: !playing || current === i ? 1 : 0.35 }}>
              <Txt style={{ fontFamily: t.fonts.reading, fontSize: 21, lineHeight: 40 }} color={current === i ? '#C9D1D9' : '#6E7781'}>
                {item.text}
              </Txt>
              {item.repeat > 1 ? (
                <Txt variant="caption" color="#4E5A66">
                  {tr(`${item.repeat} مرات`, `${item.repeat} times`)}
                </Txt>
              ) : null}
            </Tap>
          ))}
        </ScrollView>
      )}
      <View style={{ position: 'absolute', bottom: insets.bottom + 18, alignSelf: 'center' }}>
        <Tap onPress={playing ? stop : start} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: '#11161C' }}>
          {playing ? <Square size={16} color="#7C8590" /> : <Play size={18} color="#7C8590" />}
          <Txt color="#7C8590">{playing ? tr('إيقاف', 'Stop') : done ? tr('من جديد', 'Again') : tr('ابدأ', 'Start')}</Txt>
        </Tap>
      </View>
    </View>
  );
}
