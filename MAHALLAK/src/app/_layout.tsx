import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from '@/design/theme';
import { applyLanguage, restartForDirection } from '@/i18n';
import { useApp } from '@/state/appStore';
import { getStore } from '@/state/services';

void SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { isDark, c, reduceMotion } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg[1] },
          animation: reduceMotion ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="room-scan" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const ready = useApp((s) => s.ready);
  const settings = useApp((s) => s.settings);
  // Layout direction follows the app language (Arabic = RTL) regardless of the device language.
  const wantsRtl = settings.language === 'ar';
  const directionMismatch = Platform.OS !== 'web' && I18nManager.isRTL !== wantsRtl;
  const [restartSkipped, setRestartSkipped] = useState(false);

  useEffect(() => {
    void useApp.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const needsRestart = applyLanguage(settings.language);
    if (!needsRestart) return;
    // Guard against a restart loop where the platform ignores forceRTL (e.g. Expo Go).
    void (async () => {
      const key = `dir:${settings.language}`;
      const tried = await getStore().get<{ id: string }>('kv', key);
      if (tried) {
        setRestartSkipped(true);
        return;
      }
      await getStore().put('kv', { id: key, at: new Date().toISOString() });
      await restartForDirection();
    })();
  }, [ready, settings.language]);

  const directionOk = !directionMismatch || restartSkipped;
  const show = fontsLoaded && ready && directionOk;
  useEffect(() => {
    if (show) void SplashScreen.hideAsync();
  }, [show]);
  if (!show) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider mode={settings.theme} forceSolid={settings.reduceTransparency}>
        {Platform.OS === 'web' ? (
          // react-native-web resolves start/end and text alignment from this direction context.
          <View style={{ flex: 1 }} {...({ dir: settings.language === 'ar' ? 'rtl' : 'ltr', lang: settings.language } as object)}>
            <ThemedStack />
          </View>
        ) : (
          <ThemedStack />
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
