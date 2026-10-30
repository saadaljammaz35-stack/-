// «ذكر بنبض»: guided istighfar (or takbir) — a gentle vibration sets the pace and counts for you, so
// the eyes can close and the heart follow. Tapping counts by hand instead.
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Chip, IconButton, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const MODES = {
  // Al-Bukhari (6307) and Muslim (2702), as in the morning and evening adhkar.
  istighfar: { text: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', target: 100, hadith: 4808, ar: 'الاستغفار', en: 'Istighfar' },
  takbir: { text: 'اللَّهُ أَكْبَرُ', target: 100, hadith: 6255, ar: 'التكبير', en: 'Takbir' },
} as const;
type Mode = keyof typeof MODES;
const PACES = [2, 3, 4];

const buzz = (strong = false) => {
  if (Platform.OS === 'web') return;
  (strong ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => undefined);
};

export default function PulseDhikr() {
  useKeepAwake();
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'takbir' ? 'takbir' : 'istighfar');
  const m = MODES[mode];
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [pace, setPace] = useState(3);
  const finished = count >= m.target;

  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => setCount((c) => c + 1), pace * 1000);
    return () => clearInterval(id);
  }, [running, finished, pace]);
  // One pulse per count, a stronger one at the end.
  useEffect(() => {
    if (count > 0) buzz(count >= m.target);
  }, [count, m.target]);

  const tap = () => {
    if (!finished) setCount((c) => c + 1);
  };
  const reset = () => {
    setRunning(false);
    setCount(0);
  };

  return (
    <Screen title={tr(`${m.ar} بنبض`, `Guided ${m.en.toLowerCase()}`)} subtitle={tr('نبضة لكل ذكر، فأغمض عينيك وتابع', 'A pulse for each — close your eyes and follow')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(Object.keys(MODES) as Mode[]).map((k) => (
          <Chip key={k} label={tr(MODES[k].ar, MODES[k].en)} active={mode === k} onPress={() => (setMode(k), reset())} />
        ))}
      </View>
      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={tr(`عدّ: ${count} من ${m.target}`, `Count: ${count} of ${m.target}`)} style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36, borderRadius: t.radius.xl, backgroundColor: finished ? t.colors.primarySoft : t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
        <Txt center style={{ fontFamily: t.fonts.reading, fontSize: 30, lineHeight: 54 }} color={t.colors.primaryDeep}>
          {m.text}
        </Txt>
        <Txt variant="display" weight="bold" color={t.colors.primary} style={{ fontVariant: ['tabular-nums'] }}>
          {count}
        </Txt>
        <Txt variant="caption" muted>
          {finished ? tr('تمّت المئة، تقبّل الله منك', 'A hundred — may Allah accept it') : tr(`من ${m.target} · المس للعدّ يدويًا`, `of ${m.target} · tap to count by hand`)}
        </Txt>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button title={running ? tr('إيقاف مؤقت', 'Pause') : tr('ابدأ بالنبض', 'Start pulsing')} icon={running ? Pause : Play} style={{ flex: 1 }} onPress={() => setRunning((r) => !r)} disabled={finished} />
        <IconButton icon={RotateCcw} label={tr('من جديد', 'Start over')} onPress={reset} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt variant="caption" muted>
          {tr('الإيقاع', 'Pace')}
        </Txt>
        {PACES.map((p) => (
          <Chip key={p} label={tr(`كل ${p} ثوانٍ`, `Every ${p}s`)} active={pace === p} onPress={() => setPace(p)} />
        ))}
      </View>
      <Evidence id={m.hadith} full />
    </Screen>
  );
}
