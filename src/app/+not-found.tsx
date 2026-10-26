import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export default function NotFound() {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
      <EmptyState
        icon={Compass}
        title={tr('الصفحة غير موجودة', 'Page not found')}
        message={tr('ربما تغيّر الرابط.', 'The link may have changed.')}
        action={tr('العودة إلى الرئيسية', 'Back to Home')}
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
