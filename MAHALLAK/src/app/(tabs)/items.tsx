import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemTile } from '@/components/ItemCard';
import { AmbientBackground, Chip, EmptyState, Field, IconButton, Segmented, Txt } from '@/design/Glass';
import { TAB_BAR_SPACE } from '@/design/TabBar';
import { space } from '@/design/tokens';
import { CATEGORY_ICON, CATEGORY_IDS, type CategoryId } from '@/domain/categories';
import type { IconName } from '@/design/Icon';
import { matchesText } from '@/features/search/searchEngine';
import { useApp } from '@/state/appStore';
import { useDraft } from '@/state/draft';

export default function Items() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const items = useApp((s) => s.items);
  const places = useApp((s) => s.places);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const byPlace = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const data = useMemo(() => {
    const list = items.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false;
      const place = i.currentLocationId ? (byPlace.get(i.currentLocationId) ?? null) : null;
      return matchesText(i, place, q);
    });
    return sort === 'name'
      ? list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      : list.sort((a, b) => Date.parse(b.lastMovedAt ?? b.createdAt) - Date.parse(a.lastMovedAt ?? a.createdAt));
  }, [items, cat, q, sort, byPlace]);

  const usedCats = useMemo(() => CATEGORY_IDS.filter((c) => items.some((i) => i.category === c)), [items]);

  return (
    <View style={{ flex: 1 }} testID="items">
      <AmbientBackground />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.titleRow}>
          <Txt variant="title" style={{ flex: 1 }}>
            {t('items.title')}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {t('common.items', { count: items.length })}
          </Txt>
          <IconButton
            name="plus"
            label={t('home.addItem')}
            onPress={() => {
              useDraft.getState().start('create');
              router.push('/add/item');
            }}
          />
        </View>
        <Field icon="search" placeholder={t('items.search')} value={q} onChangeText={setQ} testID="items-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          <Chip label={t('items.all')} selected={cat === 'all'} onPress={() => setCat('all')} />
          {usedCats.map((c) => (
            <Chip key={c} label={t(`categories.${c}`)} icon={CATEGORY_ICON[c] as IconName} selected={cat === c} onPress={() => setCat(c)} />
          ))}
        </ScrollView>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: t('items.sortRecent') },
            { value: 'name', label: t('items.sortName') },
          ]}
        />
      </View>
      <FlashList
        data={data}
        numColumns={2}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        ListEmptyComponent={
          <View style={{ paddingTop: space.lg }}>
            <EmptyState icon="box" title={t('items.empty')} body={t('home.emptyBody')} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: 5 }}>
            <ItemTile item={item} place={item.currentLocationId ? (byPlace.get(item.currentLocationId) ?? null) : null} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.md + 2, gap: space.sm, paddingBottom: space.sm, width: '100%', maxWidth: 720, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
