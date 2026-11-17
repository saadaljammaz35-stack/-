import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground, Button, GlassCard, Txt } from '@/design/Glass';
import { Icon, type IconName } from '@/design/Icon';
import { LogoMark } from '@/design/Logo';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useApp } from '@/state/appStore';

const SLIDES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'camera', title: 'onboarding.s1Title', body: 'onboarding.s1Body' },
  { icon: 'mic', title: 'onboarding.s2Title', body: 'onboarding.s2Body' },
  { icon: 'shield', title: 'onboarding.s3Title', body: 'onboarding.s3Body' },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const settings = useApp((s) => s.settings);
  const last = i === SLIDES.length - 1;

  const finish = async () => {
    await useApp.getState().updateSettings({ onboardingDone: true });
    router.replace(useApp.getState().session ? '/home' : '/sign-in');
  };
  const slide = SLIDES[i];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]} testID="onboarding">
      <AmbientBackground />
      <View style={styles.top}>
        <Button
          kind="ghost"
          title={t('onboarding.switchLang')}
          icon="globe"
          onPress={() => void useApp.getState().updateSettings({ language: settings.language === 'ar' ? 'en' : 'ar' })}
          testID="onboarding-lang"
        />
        {!last ? <Button kind="ghost" title={t('common.skip')} onPress={() => void finish()} testID="onboarding-skip" /> : null}
      </View>
      <View style={styles.center}>
        <LogoMark size={88} />
        <Animated.View key={i} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ width: '100%' }}>
          <GlassCard padding={space.xl} radius={radius.xl}>
            <View style={{ alignItems: 'center', gap: space.md }}>
              <View style={[styles.badge, { backgroundColor: c.primary }]}>
                <Icon name={slide.icon} size={34} color={c.onPrimary} />
              </View>
              <Txt variant="display" align="center">
                {t(slide.title)}
              </Txt>
              <Txt variant="body" tone="secondary" align="center">
                {t(slide.body)}
              </Txt>
            </View>
          </GlassCard>
        </Animated.View>
        <View style={styles.dots} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: SLIDES.length, now: i + 1 }}>
          {SLIDES.map((_, k) => (
            <View key={k} style={[styles.dot, { backgroundColor: k === i ? c.primary : c.hairline, width: k === i ? 22 : 8 }]} />
          ))}
        </View>
      </View>
      <Button
        size="lg"
        title={last ? t('onboarding.start') : t('common.next')}
        onPress={() => (last ? void finish() : setI(i + 1))}
        testID="onboarding-next"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  badge: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
