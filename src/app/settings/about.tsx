import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ClipboardCopy, Globe, HeartHandshake, Library, Lock, Mail, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { StarMark, Wordmark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Card, Group, Row, Txt } from '@/components/ui';
import manifest from '@/data/db-manifest.json';
import { storeUrl, supportEmail, supportUrl } from '@/features/app-info';
import { useI18n } from '@/i18n';

export default function AboutScreen() {
  const { tr } = useI18n();
  const [copied, setCopied] = useState(false);
  const version = `${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '1'})`;
  const diagnostics = `مع الله ${version} — ${Platform.OS} ${String(Platform.Version)} — content ${manifest['content.db'].version}`;

  return (
    <Screen title={tr('التواصل والدعم', 'Contact & support')}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
        <StarMark size={56} />
        <Wordmark height={44} />
        <Txt muted center>
          {tr('رفيقك اليومي للقرآن والصلاة والذكر، بمصادر موثقة ودون إعلانات.', 'Your daily companion for Quran, prayer and dhikr — sourced, ad-free.')}
        </Txt>
        <Txt variant="caption" muted>
          {tr(`الإصدار ${version}`, `Version ${version}`)}
        </Txt>
      </Card>

      <Group>
        {supportEmail ? (
          <Row icon={Mail} title={tr('راسلنا', 'Email us')} subtitle={supportEmail} onPress={() => Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent('مع الله')}&body=${encodeURIComponent(`\n\n${diagnostics}`)}`)} />
        ) : null}
        {supportUrl ? <Row icon={Globe} title={tr('صفحة الدعم', 'Support page')} subtitle={supportUrl} onPress={() => WebBrowser.openBrowserAsync(supportUrl as string)} /> : null}
        {storeUrl ? (
          <Row icon={Share2} title={tr('شارك التطبيق', 'Share the app')} onPress={() => Share.share({ message: `${tr('تطبيق «مع الله»', 'The «Ma Allah» app')}\n${storeUrl}` })} />
        ) : null}
        <Row
          icon={ClipboardCopy}
          title={copied ? tr('تم النسخ', 'Copied') : tr('نسخ معلومات الإصدار', 'Copy version info')}
          subtitle={tr('أرفقها عند الإبلاغ عن مشكلة', 'Include it when reporting a problem')}
          chevron={false}
          onPress={async () => {
            await Clipboard.setStringAsync(diagnostics);
            setCopied(true);
          }}
        />
      </Group>

      <Group>
        <Row icon={Library} title={tr('المصادر والتوثيق', 'Sources & attribution')} onPress={() => router.push('/settings/sources')} />
        <Row icon={Lock} title={tr('الخصوصية', 'Privacy')} onPress={() => router.push('/settings/privacy')} />
        <Row icon={HeartHandshake} title={tr('التبرع عبر منصة إحسان', 'Donate via Ehsan')} onPress={() => router.push('/donate')} />
      </Group>

      <View style={{ paddingHorizontal: 8 }}>
        <Txt variant="caption" muted center>
          {tr(
            'إن وجدت خطأ في نص أو مصدر فأبلغنا ليُراجع ويُصحَّح من مصدره الأصلي.',
            'If you find an error in a text or a source, let us know so it can be checked and corrected from the original source.',
          )}
        </Txt>
      </View>
    </Screen>
  );
}
