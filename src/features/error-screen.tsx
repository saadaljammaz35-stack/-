// Shown by Expo Router in place of a screen that crashed. It renders outside the theme and
// font providers (they may be what failed), so it uses system fonts and fixed brand colours.
// Reporting is the user's choice: it opens a pre-filled email to support, nothing is sent
// automatically.
import Constants from 'expo-constants';
import type { ErrorBoundaryProps } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useSettings } from '@/store/settings';

import { supportEmail } from './app-info';

const MUTED = '#5F6A5B';
const ACCENT = '#2F4529';
const PAPER = '#FBFAF5';

export function reportBody(error: Error): string {
  const version = Constants.expoConfig?.version ?? '?';
  const stack = (error.stack ?? '').split('\n').slice(0, 8).join('\n');
  return [`App: ${version} (${Platform.OS} ${String(Platform.Version)})`, `Error: ${error.message}`, '', stack].join('\n');
}

export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const ar = useSettings((s) => s.language) !== 'en';
  const tr = (a: string, e: string) => (ar ? a : e);
  const report = () => {
    if (!supportEmail) return;
    const subject = encodeURIComponent(tr('بلاغ عن خطأ في تطبيق مع الله', 'Ma Allah app error report'));
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${encodeURIComponent(reportBody(error))}`).catch(() => undefined);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAPER }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: ACCENT, textAlign: 'center' }}>{tr('حدث خطأ غير متوقع', 'Something went wrong')}</Text>
      <Text style={{ fontSize: 15, lineHeight: 24, color: MUTED, textAlign: 'center' }}>
        {tr('لم تُفقد بياناتك. جرّب مرة أخرى، وإن تكرر الخطأ فأرسل لنا بلاغًا لنصلحه.', 'Your data is safe. Try again, and if it keeps happening, send us a report so we can fix it.')}
      </Text>
      <View style={{ gap: 10, marginTop: 6 }}>
        <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: ACCENT, borderRadius: 999, paddingVertical: 13, alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>{tr('حاول مرة أخرى', 'Try again')}</Text>
        </Pressable>
        {supportEmail ? (
          <Pressable accessibilityRole="button" onPress={report} style={{ backgroundColor: '#E3EADB', borderRadius: 999, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>{tr('أرسل بلاغًا بالبريد', 'Email a report')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text selectable style={{ fontSize: 12, color: MUTED, opacity: 0.8, textAlign: 'left', writingDirection: 'ltr', marginTop: 8 }} numberOfLines={4}>
        {error.message}
      </Text>
    </ScrollView>
  );
}
