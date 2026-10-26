import { useLocalSearchParams } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, EmptyState, Txt } from '@/components/ui';
import { LEGAL_DOCS } from '@/content/legal';
import { supportEmail } from '@/features/app-info';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export default function LegalScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = LEGAL_DOCS[doc as keyof typeof LEGAL_DOCS];
  if (!page) {
    return (
      <Screen title={tr('غير موجود', 'Not found')}>
        <EmptyState icon={FileText} title={tr('الصفحة غير موجودة', 'Page not found')} />
      </Screen>
    );
  }
  return (
    <Screen title={tr(page.title.ar, page.title.en)} subtitle={tr(page.updated.ar, page.updated.en)}>
      {page.sections.map((s) => (
        <Card key={s.heading.en} style={{ gap: 8 }}>
          <Txt weight="semibold" color={t.colors.primaryDeep}>
            {tr(s.heading.ar, s.heading.en)}
          </Txt>
          {s.paragraphs.map((p) => (
            <Txt key={p.en} muted style={{ lineHeight: t.fs(15) * 1.8 }}>
              {tr(p.ar, p.en)}
            </Txt>
          ))}
        </Card>
      ))}
      {supportEmail ? (
        <View style={{ paddingHorizontal: 6 }}>
          <Txt variant="caption" muted>
            {tr(`للتواصل: ${supportEmail}`, `Contact: ${supportEmail}`)}
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}
