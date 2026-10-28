import { router } from 'expo-router';
import { Heart, Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { StarMark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Card, Txt } from '@/components/ui';
import { listPerf } from '@/components/list';
import { getNames, type NameOfAllah } from '@/data/content';
import { useI18n } from '@/i18n';
import { useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function NamesIndex() {
  const t = useTheme();
  const { tr } = useI18n();
  const [names, setNames] = useState<NameOfAllah[]>([]);
  const favorites = useAdhkarStore((s) => s.favorites);
  useEffect(() => {
    getNames().then(setNames);
  }, []);
  return (
    <Screen title={tr('أسماء الله الحسنى', 'The Beautiful Names')} scroll={false}>
      <FlatList
        {...listPerf}
        data={names}
        numColumns={3}
        keyExtractor={(n) => String(n.n)}
        contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
        columnWrapperStyle={{ gap: 10 }}
        ListHeaderComponent={
          <Card tone="soft" style={{ gap: 6, marginBottom: 12, marginHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Info size={18} color={t.colors.primaryDeep} />
              <Txt weight="semibold" color={t.colors.primaryDeep}>
                {tr('عن هذه القائمة', 'About this list')}
              </Txt>
            </View>
            <Txt variant="caption">
              {tr(
                'ثبت في صحيح البخاري (2736، 7392) وصحيح مسلم (2677): «إن لله تسعة وتسعين اسمًا، مائة إلا واحدًا، من أحصاها دخل الجنة». أما سرد الأسماء على هذا الترتيب فهو في جامع الترمذي (3507)، وقد ضعّف إسناده الألباني وأحمد شاكر وغيرهما، ولذلك تُعرض القائمة مع بيان مصدرها. والشرح للإمام الخطابي (ت 388هـ) في «شأن الدعاء».',
                'Bukhari (2736, 7392) and Muslim (2677) report that Allah has ninety-nine names. The enumeration itself comes from al-Tirmidhi (3507), whose chain was graded weak by al-Albani, Ahmad Shakir and others; explanations by al-Khattabi (d. 388 AH).',
              )}
            </Txt>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/names/[n]', params: { n: String(item.n) } })} style={({ pressed }) => ({ flex: 1, marginBottom: 10, backgroundColor: t.colors.surface, borderRadius: 18, paddingVertical: 16, alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1, maxWidth: '32%' })}>
            <View style={{ position: 'absolute', top: 6, left: 6 }}>{favorites.includes(`name:${item.n}`) ? <Heart size={12} color={t.colors.danger} fill={t.colors.danger} /> : null}</View>
            <StarMark size={22} />
            <Txt style={{ fontFamily: t.fonts.readingBold, fontSize: t.fs(22), lineHeight: t.fs(36) }} color={t.colors.primaryDeep} center>
              {item.name}
            </Txt>
            <Txt variant="label" muted>
              {item.n}
            </Txt>
          </Pressable>
        )}
      />
    </Screen>
  );
}
