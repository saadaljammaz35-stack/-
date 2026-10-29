import { router } from 'expo-router';
import { BookHeart, BookOpen, CloudRain, HandCoins, HandHeart, HeartPulse, House, NotebookPen, Plane, RefreshCw, Sparkles, Users, Wind, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, ForwardChevron, IconCircle, Txt } from '@/components/ui';
import { getDuaCategories, type Category } from '@/data/content';
import { useI18n } from '@/i18n';
import { useDuaStore } from '@/store/user';
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
  const pending = useDuaStore((s) => s.duas.filter((d) => !d.answeredAt).length);
  useEffect(() => {
    getDuaCategories().then(setCats);
  }, []);
  return (
    <Screen title={tr('الأدعية', 'Duas')} subtitle={tr('من القرآن الكريم وحصن المسلم والموسوعة الحديثية', 'From the Quran, Hisn al-Muslim and HadeethEnc')}>
      <Card tone="primary" onPress={() => router.push('/duas/mine')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle icon={NotebookPen} size={48} tint="rgba(255,255,255,0.16)" color={t.colors.onPrimary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="bold" color={t.colors.onPrimary}>
            {tr('دفتر دعائي', 'My duas')}
          </Txt>
          <Txt variant="caption" color={t.colors.onPrimary} style={{ opacity: 0.85 }}>
            {pending ? tr(`أدعيتك (${pending}) تنتظر أوقات الإجابة`, `${pending} duas waiting for the times of answer`) : tr('اكتب حاجتك وادعُ بها في أوقات الإجابة', 'Write your needs and ask at the times of answer')}
          </Txt>
        </View>
        <ForwardChevron color={t.colors.onPrimary} />
      </Card>
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
