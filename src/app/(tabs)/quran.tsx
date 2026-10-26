import { router } from 'expo-router';
import { BookOpen, Headphones, Search, Target } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StarPattern } from '@/components/brand';
import { TAB_BAR_SPACE } from '@/components/screen';
import { Card, IconButton, IconCircle, Txt } from '@/components/ui';
import { QuranIndex } from '@/features/quran/quran-index';
import { useI18n } from '@/i18n';
import { useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function QuranTab() {
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const lastRead = useQuranStore((s) => s.lastRead);

  const header = (
    <View style={{ gap: 14, paddingTop: insets.top + 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="display" color={t.colors.primaryDeep}>
          {tr('القرآن الكريم', 'The Quran')}
        </Txt>
        <IconButton icon={Search} label={tr('البحث في القرآن', 'Search the Quran')} onPress={() => router.push('/quran/search')} size={46} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={() => router.push({ pathname: '/mushaf', params: { page: String(lastRead?.page ?? 1) } })}>
          <IconCircle icon={BookOpen} size={44} />
          <Txt weight="semibold" style={{ marginTop: 8 }}>
            {lastRead ? tr('متابعة القراءة', 'Continue') : tr('افتح المصحف', 'Open mushaf')}
          </Txt>
          <Txt variant="caption" muted>
            {tr(`الصفحة ${lastRead?.page ?? 1}`, `Page ${lastRead?.page ?? 1}`)}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/khatma')}>
          <IconCircle icon={Target} size={44} tint={t.colors.tints[3]} />
          <Txt weight="semibold" style={{ marginTop: 8 }}>
            {tr('الختمة', 'Khatma')}
          </Txt>
          <Txt variant="caption" muted>
            {tr('خطط وورد يومي', 'Plans & daily portion')}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/quran/reciters')}>
          <IconCircle icon={Headphones} size={44} tint={t.colors.tints[1]} />
          <Txt weight="semibold" style={{ marginTop: 8 }}>
            {tr('الاستماع', 'Listen')}
          </Txt>
          <Txt variant="caption" muted>
            {tr('القراء والتحميل', 'Reciters & offline')}
          </Txt>
        </Card>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <StarPattern />
      <QuranIndex header={header} bottomInset={TAB_BAR_SPACE + insets.bottom} />
    </View>
  );
}
