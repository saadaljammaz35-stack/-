import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AmbientBackground, Txt } from '@/design/Glass';
import { Logo } from '@/design/Logo';
import { useTheme } from '@/design/theme';
import { useApp } from '@/state/appStore';

/** In-app splash: the mark materializes, then routes to onboarding, sign-in or home. */
export default function Splash() {
  const { t } = useTranslation();
  const { reduceMotion } = useTheme();
  useEffect(() => {
    const id = setTimeout(() => {
      const { settings, session } = useApp.getState();
      if (!settings.onboardingDone) router.replace('/onboarding');
      else if (!session && !settings.guest) router.replace('/sign-in');
      else router.replace('/home');
    }, 1100);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={styles.root} testID="splash">
      <AmbientBackground />
      <Animated.View entering={reduceMotion ? FadeIn.duration(300) : ZoomIn.springify().damping(18)} style={{ alignItems: 'center' }}>
        <Logo size={120} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(450).duration(500)}>
        <Txt variant="callout" tone="secondary" align="center">
          {t('common.tagline')}
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 } });
