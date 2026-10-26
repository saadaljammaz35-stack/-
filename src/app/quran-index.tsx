import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { useMushafNav } from '@/features/mushaf/nav';
import { QuranIndex } from '@/features/quran/quran-index';
import { useI18n } from '@/i18n';

export default function QuranIndexScreen() {
  const { tr } = useI18n();
  return (
    <Screen title={tr('فهرس المصحف', 'Mushaf index')} scroll={false}>
      <View style={{ flex: 1 }}>
        <QuranIndex
          bottomInset={40}
          onSelect={(page, verse) => {
            useMushafNav.getState().go(page, verse);
            if (router.canGoBack()) router.back();
            else router.replace({ pathname: '/mushaf', params: { page: String(page) } });
          }}
        />
      </View>
    </Screen>
  );
}
