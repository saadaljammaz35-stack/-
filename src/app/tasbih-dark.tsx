// «تسبيح بدون شاشة»: a black screen at the lowest brightness that counts a tap anywhere, with a
// light tap felt for each count and a strong one at the end of each round. On Android the volume
// buttons count too; on iPhone, Back Tap can run the «سبّح» shortcut with the screen locked.
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { Eye, EyeOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useTasbihStore } from '@/store/user';

type Keys = { start: () => boolean; stop: () => void; addListener: (event: 'onKey', cb: (e: { key: 'up' | 'down' }) => void) => { remove: () => void } };
const TasbihKeys = Platform.OS === 'android' ? requireOptionalNativeModule<Keys>('TasbihKeys') : null;

export default function TasbihDark() {
  useKeepAwake();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const s = useTasbihStore();
  const active = s.counters.find((c) => c.id === s.activeId) ?? s.counters[0];
  const [show, setShow] = useState(false);
  const tapRef = useRef<() => void>(() => undefined);

  const tap = () => {
    const before = useTasbihStore.getState().counters.find((c) => c.id === useTasbihStore.getState().activeId)?.rounds ?? 0;
    const after = useTasbihStore.getState().tap(today);
    if (Platform.OS !== 'web') {
      if (after.rounds > before) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };
  useEffect(() => {
    tapRef.current = tap;
  });

  // Lowest brightness while here, back to how it was on leaving.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let before: number | null = null;
    Brightness.getBrightnessAsync()
      .then((b) => {
        before = b;
        return Brightness.setBrightnessAsync(0.01);
      })
      .catch(() => undefined);
    return () => {
      if (before != null) Brightness.setBrightnessAsync(before).catch(() => undefined);
    };
  }, []);

  // Android: the volume buttons count while this screen is open.
  useEffect(() => {
    if (!TasbihKeys) return;
    const sub = TasbihKeys.addListener('onKey', () => tapRef.current());
    TasbihKeys.start();
    const app = AppState.addEventListener('change', (state) => state === 'active' && TasbihKeys.start());
    return () => {
      sub.remove();
      app.remove();
      TasbihKeys.stop();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />
      <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={tap} accessibilityLabel={tr('سبّح', 'Count')}>
        {show && active ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Txt color="#2A2F35" style={{ fontSize: 22, lineHeight: 36 }}>
              {active.label}
            </Txt>
            <Txt color="#3A4047" style={{ fontSize: 64, lineHeight: 84, fontVariant: ['tabular-nums'] }}>
              {active.count}
            </Txt>
            {active.target ? <Txt color="#2A2F35">{`/ ${active.target}${active.rounds ? ` · ${active.rounds}×` : ''}`}</Txt> : null}
          </View>
        ) : null}
      </Pressable>
      <View style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
        <IconButton icon={X} label={tr('خروج', 'Exit')} tone="plain" color="#2A2F35" onPress={() => router.back()} />
        <IconButton icon={show ? EyeOff : Eye} label={show ? tr('إخفاء العدد', 'Hide count') : tr('إظهار العدد', 'Show count')} tone="plain" color="#2A2F35" onPress={() => setShow((v) => !v)} />
      </View>
      <Txt color="#1E2226" center style={{ position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20, fontSize: 12 }}>
        {TasbihKeys
          ? tr('المس أي مكان أو اضغط زر الصوت للعدّ. تهتز اهتزازة قوية عند تمام كل دورة.', 'Tap anywhere or press a volume button. A strong buzz marks each round.')
          : tr('المس أي مكان للعدّ. تهتز اهتزازة قوية عند تمام كل دورة.', 'Tap anywhere to count. A strong buzz marks each round.')}
      </Txt>
    </View>
  );
}
