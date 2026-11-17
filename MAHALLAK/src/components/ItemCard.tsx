import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ImageRef, Item, Place } from '@/domain/models';
import { GlassCard, Txt } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { relativeTime, type Lang } from '@/i18n';
import { useApp } from '@/state/appStore';

import { ItemImage } from './ItemImage';

export function placeLabel(place: Place | null, t: (k: string) => string): string {
  if (!place) return '';
  const room = place.roomLabel || t(`rooms.${place.room}`);
  return `${room} · ${place.spot}`;
}

/** Square tile for grids (home carousel, favorites, all items). */
export function ItemTile({ item, place, width }: { item: Item; place: Place | null; width?: number }) {
  const { t } = useTranslation();
  const images = useApp((s) => s.images);
  const image: ImageRef | undefined = images[item.cutoutImageId ?? item.originalImageId ?? ''];
  return (
    <GlassCard
      onPress={() => router.push(`/item/${item.id}`)}
      padding={10}
      radius={radius.lg}
      style={width ? { width } : { flex: 1 }}
      accessibilityLabel={item.name}
      testID={`item-${item.id}`}
    >
      <ItemImage image={image} category={item.category} cutout={Boolean(item.cutoutImageId)} radius={radius.md} />
      <View style={{ paddingTop: 8, gap: 2 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </Txt>
        <View style={styles.placeLine}>
          <Icon name="pin" size={13} color={useTheme().c.accentText} />
          <Txt variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {placeLabel(place, t)}
          </Txt>
        </View>
      </View>
    </GlassCard>
  );
}

/** Wide result card: item photo, last recorded place, place photo and when it was recorded. */
export function ResultCard({ item, place, testID }: { item: Item; place: Place | null; testID?: string }) {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const images = useApp((s) => s.images);
  const image = images[item.cutoutImageId ?? item.originalImageId ?? ''];
  const placeImage = place?.imageId ? images[place.imageId] : null;
  return (
    <GlassCard onPress={() => router.push(`/item/${item.id}`)} padding={12} accessibilityLabel={item.name} testID={testID}>
      <View style={styles.resultRow}>
        <ItemImage image={image} category={item.category} cutout={Boolean(item.cutoutImageId)} size={84} radius={radius.md} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="headline" numberOfLines={1}>
            {item.name}
          </Txt>
          <Txt variant="micro" tone="accent">
            {t('voice.lastSeen')}
          </Txt>
          <View style={styles.placeLine}>
            <Icon name="pin" size={15} color={c.accentText} />
            <Txt variant="callout" numberOfLines={2} style={{ flex: 1 }}>
              {placeLabel(place, t)}
            </Txt>
          </View>
          <Txt variant="caption" tone="tertiary">
            {t('item.recorded', { when: relativeTime(item.lastMovedAt ?? item.createdAt, i18n.language as Lang) })}
          </Txt>
        </View>
        {placeImage ? <ItemImage image={placeImage} size={64} radius={radius.sm} placeholderIcon="pin" /> : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
