import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { Button, EmptyState } from '@/design/Glass';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen back>
      <EmptyState icon="pin" title={t('item.notFound')} body="" />
      <Button title={t('tabs.home')} onPress={() => router.replace('/home')} />
    </Screen>
  );
}
