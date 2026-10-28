import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ForwardChevron, Loading, Txt } from '@/components/ui';
import { listPerf } from '@/components/list';
import { getEncByCategory, getEncCategories, getEncCategory, type EncCategory, type EncHadith } from '@/data/content';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

/** Browses HadeethEnc categories; a category without sub-categories lists its hadiths. */
export default function EncBrowse() {
  const t = useTheme();
  const { tr } = useI18n();
  const { parent } = useLocalSearchParams<{ parent?: string }>();
  const parentId = parent ? Number(parent) : null;
  const [title, setTitle] = useState(tr('الموسوعة الحديثية', 'Hadith encyclopedia'));
  const [cats, setCats] = useState<EncCategory[] | null>(null);
  const [hadiths, setHadiths] = useState<EncHadith[]>([]);

  useEffect(() => {
    (async () => {
      if (parentId != null) {
        const c = await getEncCategory(parentId);
        if (c) setTitle(c.title);
      }
      const children = await getEncCategories(parentId);
      setCats(children);
      if (parentId != null) setHadiths(await getEncByCategory(parentId, 300));
    })();
  }, [parentId]);

  if (!cats) return <Screen title={title}><Loading /></Screen>;
  return (
    <Screen title={title} subtitle="HadeethEnc.com" scroll={false}>
      <FlatList
        {...listPerf}
        data={hadiths}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 16, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 2, marginBottom: 10 }}>
            {cats.map((c) => (
              <Pressable key={c.id} onPress={() => router.push({ pathname: '/hadith/enc', params: { parent: String(c.id) } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1, borderBottomWidth: 1, borderBottomColor: t.colors.border })}>
                <View style={{ flex: 1 }}>
                  <Txt weight="medium">{c.title}</Txt>
                </View>
                <ForwardChevron />
              </Pressable>
            ))}
            {hadiths.length && cats.length ? (
              <Txt weight="semibold" style={{ marginTop: 14 }}>
                {tr('أحاديث هذا الباب', 'Hadiths in this topic')}
              </Txt>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(item.id) } })} style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 14, gap: 4 }}>
            <Txt weight="medium">{item.title}</Txt>
            <Txt variant="caption" muted>{`${item.attribution} — ${item.grade}`}</Txt>
          </Pressable>
        )}
      />
    </Screen>
  );
}
