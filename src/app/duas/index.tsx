import { router } from 'expo-router';
import { BookHeart, BookOpen, CloudRain, HandCoins, HandHeart, HeartPulse, House, Plane, RefreshCw, Sparkles, Users, Wind, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, IconCircle, Txt } from '@/components/ui';
import { getDuaCategories, type Category } from '@/data/content';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const ICONS: Record<string, LucideIcon> = {
  quran: BookOpen,
  prophets: Sparkles,
  prophetic: BookHeart,
  grief: CloudRain,
  distress: Wind,
  provision: HandCoins,
  healing: HeartPulse,
  travel: Plane,
  repentance: RefreshCw,
  parents: Users,
  deceased: HandHeart,
  marriage: House,
};

export default function DuasIndex() {
  const t = useTheme();
  const { tr } = useI18n();
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    getDuaCategories().then(setCats);
  }, []);
  return (
    <Screen title={tr('الأدعية', 'Duas')} subtitle={tr('من القرآن الكريم وحصن المسلم والموسوعة الحديثية', 'From the Quran, Hisn al-Muslim and HadeethEnc')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cats.map((c, i) => (
          <Card key={c.id} style={{ width: '47.8%', gap: 10 }} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `dua:${c.id}` } })}>
            <IconCircle icon={ICONS[c.id] ?? BookHeart} size={48} tint={t.colors.tints[i % 6]} />
            <Txt weight="semibold">{c.title}</Txt>
          </Card>
        ))}
      </View>
      <Txt variant="caption" muted center>
        {tr('كل دعاء مقرون بمصدره. ما لم يثبت عن النبي ﷺ لا يُنسب إليه.', 'Every dua shows its source; nothing unproven is attributed to the Prophet ﷺ.')}
      </Txt>
    </Screen>
  );
}
