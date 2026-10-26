import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StarMark } from '@/components/brand';
import { Button, Txt } from '@/components/ui';
import { getContentDb, isBusyStorageError } from '@/data/db';
import { AppServices } from '@/features/services';
import { ErrorScreen } from '@/features/error-screen';
import { PlayerProvider } from '@/features/audio/player';
import { useSettings } from '@/store/settings';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function useContentReady() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    getContentDb()
      .then(() => alive && setState('ready'))
      .catch((e: Error) => {
        if (Platform.OS === 'web' && isBusyStorageError(e)) {
          // The previous page is still releasing the database; reload a few times, spaced out,
          // to get a fresh worker (bounded so it can never loop).
          const recent = (JSON.parse(sessionStorage.getItem('maallah:reloads') ?? '[]') as number[]).filter((t) => Date.now() - t < 60_000);
          if (recent.length < 4) {
            sessionStorage.setItem('maallah:reloads', JSON.stringify([...recent, Date.now()]));
            setTimeout(() => window.location.reload(), 1000 * (recent.length + 1));
            return;
          }
        }
        if (alive) setState(e);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  return {
    state,
    retry: () => {
      if (Platform.OS === 'web') {
        window.location.reload();
        return;
      }
      setState('loading');
      setAttempt((a) => a + 1);
    },
  };
}

function Shell() {
  const t = useTheme();
  const language = useSettings((s) => s.language);
  const { state, retry } = useContentReady();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    Amiri_400Regular,
    Amiri_700Bold,
    UthmanicHafs: require('../../assets/fonts/UthmanicHafs1Ver18.ttf'),
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      if (!document.getElementById('maallah-web')) {
        // Text fields get the app's own focus styling instead of the browser outline.
        const style = document.createElement('style');
        style.id = 'maallah-web';
        style.textContent = 'input, textarea { outline: none; }';
        document.head.appendChild(style);
      }
    }
  }, [language]);

  const ready = (fontsLoaded || fontError) && state !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    // Native keeps the splash screen up; the web build shows progress while the content
    // database downloads on the first visit.
    if (Platform.OS !== 'web') return null;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32, backgroundColor: '#FBFAF5' }}>
        <StarMark size={72} />
        <ActivityIndicator color="#5A6E51" />
        <Text style={{ color: '#5A6E51', fontSize: 15, textAlign: 'center', writingDirection: 'rtl' }}>
          {'جارٍ تجهيز المحتوى… قد يستغرق أول فتح دقيقة.'}
        </Text>
      </View>
    );
  }
  if (state instanceof Error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: t.colors.background }}>
        <StarMark size={72} />
        <Txt variant="heading" center>
          تعذّر تجهيز قاعدة البيانات
        </Txt>
        <Txt muted center>
          {state.message}
        </Txt>
        <Button title="إعادة المحاولة" onPress={retry} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, direction: language === 'ar' ? 'rtl' : 'ltr', backgroundColor: t.colors.background }}>
      <StatusBar style={t.colors.scheme === 'dark' ? 'light' : 'dark'} />
      <PlayerProvider>
        <AppServices />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.colors.background },
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mushaf" options={{ animation: 'fade' }} />
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        </Stack>
      </PlayerProvider>
    </View>
  );
}

/** Any screen that crashes is replaced by a recoverable error screen instead of a blank app. */
export const ErrorBoundary = ErrorScreen;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
