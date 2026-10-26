import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, HandCoins, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, IconCircle, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const EHSAN_URL = 'https://ehsan.sa';

export default function DonateScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <Screen title={tr('إحسان', 'Ehsan')}>
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <IconCircle icon={HandCoins} size={84} />
        <Txt variant="title" center>
          {tr('المنصة الوطنية للعمل الخيري «إحسان»', 'Ehsan — the national charity platform')}
        </Txt>
        <Txt muted center>
          {tr('يفتح التبرع في الموقع الرسمي لمنصة إحسان مباشرة، وتتم عملية الدفع بالكامل هناك.', 'Donations open directly on the official Ehsan website, where payment is completed.')}
        </Txt>
        <Button title={tr('فتح منصة إحسان', 'Open Ehsan')} icon={ExternalLink} onPress={() => WebBrowser.openBrowserAsync(EHSAN_URL).catch(() => undefined)} />
        <Txt variant="caption" muted>
          ehsan.sa
        </Txt>
      </Card>
      <Card style={{ flexDirection: 'row', gap: 10 }}>
        <ShieldCheck size={22} color={t.colors.success} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt weight="semibold">{tr('خصوصيتك محفوظة', 'Your privacy')}</Txt>
          <Txt variant="caption" muted>
            {tr('لا يجمع «مع الله» أي بيانات بطاقات أو مدفوعات، ولا يعرض حملات من غير المنصة الرسمية.', 'Ma‘a Allah never collects card or payment data and shows no campaigns of its own.')}
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}
