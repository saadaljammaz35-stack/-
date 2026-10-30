import { router } from 'expo-router';
import { BookHeart, Brain, Calendar, Droplets, HandHeart, Heart, House, Library, MapPinned, Moon, MoonStar, Mosque, Plane, Shield, Sparkles, Sun, Sunrise, Sunset, Target, Utensils, Vibrate, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TabScreen } from '@/components/screen';
import { Card, Group, IconCircle, Row, SectionHeader, Tap, Txt } from '@/components/ui';
import { getAdhkarCategories, type Category } from '@/data/content';
import { useI18n } from '@/i18n';
import { useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

const ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  sunset: Sunset,
  moon: Moon,
  sun: Sun,
  prayer: HandHeart,
  mosque: Mosque,
  home: House,
  food: Utensils,
  travel: Plane,
  calendar: Calendar,
  heart: Heart,
  tasbih: Target,
  shield: Shield,
  water: Droplets,
};

export default function AdhkarTab() {
  const t = useTheme();
  const { tr } = useI18n();
  const [cats, setCats] = useState<Category[]>([]);
  const favorites = useAdhkarStore((s) => s.favorites);

  useEffect(() => {
    getAdhkarCategories().then(setCats);
  }, []);

  const [morning, evening, ...rest] = cats;

  return (
    <TabScreen title={tr('الأذكار', 'Adhkar')}>
      <View style={{ paddingHorizontal: 20, gap: 22 }}>
        {morning && evening ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[morning, evening].map((c, i) => (
              <Card key={c.id} tone={i === 0 ? 'soft' : 'primary'} style={{ flex: 1, gap: 10 }} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: c.id } })}>
                {i === 0 ? <Sunrise size={30} color={t.colors.primaryDeep} /> : <Sunset size={30} color="#FFFFFF" />}
                <Txt variant="subheading" weight="bold" color={i === 0 ? t.colors.primaryDeep : '#FFFFFF'}>
                  {c.title}
                </Txt>
                <Txt variant="caption" color={i === 0 ? t.colors.textMuted : 'rgba(255,255,255,0.8)'}>
                  {tr('مع العدّاد والصوت والتخريج', 'With counter, audio and sources')}
                </Txt>
              </Card>
            ))}
          </View>
        ) : null}

        <View>
          <SectionHeader title={tr('أذكار اليوم والليلة', 'Daily adhkar')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {rest.map((c, i) => {
              const Icon = ICONS[c.icon ?? ''] ?? Sparkles;
              return (
                <Tap key={c.id} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: c.id } })} style={{ width: '30.5%', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                  <IconCircle icon={Icon} size={70} tint={t.colors.tints[i % 6]} iconSize={28} />
                  <Txt variant="caption" center numberOfLines={2}>
                    {c.title}
                  </Txt>
                </Tap>
              );
            })}
          </View>
        </View>

        <Group title={tr('المكتبة', 'Library')}>
          <Row icon={MapPinned} title={tr('أذكار المواقف', 'Adhkar for the moment')} subtitle={tr('البيت والمسجد والسوق والمطر والريح والهلال والغضب…', 'Home, mosque, market, rain, wind, the new moon, anger…')} onPress={() => router.push('/adhkar/situations')} />
          <Row icon={MoonStar} title={tr('أذكار النوم الهادئة', 'Calm sleep adhkar')} subtitle={tr('تُتلى متتابعة على شاشة مظلمة ويخفت الصوت حتى تنام', 'Recited in turn on a dark screen, softer and softer')} onPress={() => router.push('/adhkar/sleep-calm')} />
          <Row icon={Brain} title={tr('حفظ الأذكار', 'Learn the adhkar by heart')} subtitle={tr('أذكار الصباح والمساء بالمراجعة المتباعدة', 'Morning and evening adhkar with spaced review')} onPress={() => router.push('/adhkar/memorize')} />
          <Row icon={Vibrate} title={tr('الاستغفار والتكبير بنبض', 'Guided istighfar and takbir')} subtitle={tr('نبضة اهتزاز لكل ذكر، فتذكر وعيناك مغمضتان', 'A pulse for each, eyes closed')} onPress={() => router.push('/adhkar/pulse')} />
          <Row icon={Library} title={tr('حصن المسلم كاملًا', 'Complete Hisn al-Muslim')} subtitle={tr('132 بابًا مع التخريج والصوت', '132 chapters with takhrij and audio')} onPress={() => router.push('/hisn')} />
          <Row icon={BookHeart} title={tr('الأدعية', 'Duas')} subtitle={tr('أدعية القرآن والأنبياء والسنة مصنفة بالموضوع', 'Quranic, prophetic and topical duas')} onPress={() => router.push('/duas')} />
          <Row icon={Target} title={tr('المسبحة الإلكترونية', 'Tasbih counter')} onPress={() => router.push('/tasbih')} />
          <Row icon={Heart} title={tr('المفضلة', 'Favourites')} subtitle={tr(`${favorites.length} ذكرًا محفوظًا`, `${favorites.length} saved`)} onPress={() => router.push('/saved')} />
        </Group>
      </View>
    </TabScreen>
  );
}
