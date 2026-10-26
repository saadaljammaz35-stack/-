import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ForwardChevron, Txt } from '@/components/ui';
import { getHisnChapters } from '@/data/content';
import { useI18n } from '@/i18n';
import { normalizeArabic } from '@/lib/arabic';
import { useTheme } from '@/theme';

export default function HisnIndex() {
  const t = useTheme();
  const { tr } = useI18n();
  const [chapters, setChapters] = useState<{ id: number; title: string; count: number }[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    getHisnChapters().then(setChapters);
  }, []);
  const list = useMemo(() => {
    const q = normalizeArabic(query);
    return q ? chapters.filter((c) => normalizeArabic(c.title).includes(q)) : chapters;
  }, [chapters, query]);
  return (
    <Screen title={tr('حصن المسلم', 'Hisn al-Muslim')} subtitle={tr('د. سعيد بن علي بن وهف القحطاني', 'Dr. Sa‘id al-Qahtani')} scroll={false}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('ابحث في أبواب الكتاب', 'Search chapters')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, paddingVertical: 11, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }}
          />
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${item.id}` } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' })}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="caption" weight="bold" color={t.colors.primaryDeep}>
                {item.id}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="medium">{item.title}</Txt>
              <Txt variant="caption" muted>
                {tr(`${item.count} ذكرًا`, `${item.count} items`)}
              </Txt>
            </View>
            <ForwardChevron />
          </Pressable>
        )}
      />
    </Screen>
  );
}
