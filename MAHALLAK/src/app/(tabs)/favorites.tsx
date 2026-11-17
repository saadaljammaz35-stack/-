import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ItemTile } from '@/components/ItemCard';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/design/Glass';
import { space } from '@/design/tokens';
import { useApp } from '@/state/appStore';

export default function Favorites() {
  const { t } = useTranslation();
  const items = useApp((s) => s.items);
  const places = useApp((s) => s.places);
  const byPlace = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const favs = items.filter((i) => i.favorite);
  const rows: Array<typeof favs> = [];
  for (let i = 0; i < favs.length; i += 2) rows.push(favs.slice(i, i + 2));
  return (
    <Screen title={t('favorites.title')} tabBar testID="favorites">
      {favs.length === 0 ? (
        <EmptyState icon="heart" title={t('favorites.emptyTitle')} body={t('favorites.emptyBody')} />
      ) : (
        rows.map((row, k) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.sm }}>
            {row.map((it) => (
              <ItemTile key={it.id} item={it} place={it.currentLocationId ? (byPlace.get(it.currentLocationId) ?? null) : null} />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))
      )}
    </Screen>
  );
}
