import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import { LockGate } from '../LockGate';
import { configureAndroidChannel } from '../services/notifications';
import { SettingsProvider } from '../services/settings';
import { ReceiptsProvider } from '../state/receipts';
import { ThemeProvider, useTheme } from '../theme';

// ضَمان is Arabic-only, so the layout is right-to-left for every user. This has
// to run before the first render; a change afterwards needs an app restart.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

/**
 * To turn on automatic receipt reading, register a text recogniser here — the
 * parser is already built and tested. See README.md § "تشغيل قراءة الفاتورة
 * تلقائيًا" for the two supported approaches.
 *
 *   import { registerTextRecognizer } from '../services/ocr';
 *   registerTextRecognizer(async (uri) => recognise(uri));
 */

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <ReceiptsProvider>
            <StatusBar style="auto" />
            <LockGate>
              <Navigator />
            </LockGate>
          </ReceiptsProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    void configureAndroidChannel();
  }, []);

  /** Tapping a reminder opens the receipt it is about. */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const receiptId = response.notification.request.content.data?.receiptId;
      if (typeof receiptId === 'string') router.push(`/receipt/${receiptId}`);
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.colors.brand,
        headerTitleStyle: { color: theme.colors.label },
        // Translucent, blurred headers are what makes an iOS app feel native.
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: theme.appearance === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.colors.groupedBackground },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'خزنتي', headerLargeTitle: true, headerLargeTitleShadowVisible: false }}
      />
      <Stack.Screen name="receipt/[id]" options={{ title: 'الفاتورة' }} />
      <Stack.Screen name="receipt/form" options={{ title: 'فاتورة جديدة', presentation: 'modal' }} />
      <Stack.Screen name="receipt/claim" options={{ title: 'مطالبة' }} />
      <Stack.Screen name="settings" options={{ title: 'الإعدادات' }} />
    </Stack>
  );
}
