import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { placeLabel } from '@/components/ItemCard';
import { ItemImage } from '@/components/ItemImage';
import { Screen } from '@/components/Screen';
import { Button, Chip, EmptyState, GlassCard, IconButton, Row, Segmented, Txt, haptic } from '@/design/Glass';
import type { IconName } from '@/design/Icon';
import { Icon } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { CATEGORY_ICON, COLOR_SWATCH } from '@/domain/categories';
import { formatDate, relativeTime, type Lang } from '@/i18n';
import { useApp } from '@/state/appStore';
import { useDraft } from '@/state/draft';
import { getItemService } from '@/state/services';

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const item = useApp((s) => s.items.find((i) => i.id === id));
  const place = useApp((s) => s.places.find((p) => p.id === item?.currentLocationId) ?? null);
  const images = useApp((s) => s.images);
  const [view, setView] = useState<'cutout' | 'original'>('cutout');
  const lang = i18n.language as Lang;

  if (!item) {
    return (
      <Screen back>
        <EmptyState icon="box" title={t('item.notFound')} body="" />
      </Screen>
    );
  }

  const original = item.originalImageId ? images[item.originalImageId] : null;
  const cutout = item.cutoutImageId ? images[item.cutoutImageId] : null;
  const shown = view === 'cutout' && cutout ? cutout : original;
  const placeImage = place?.imageId ? images[place.imageId] : null;
  const when = item.lastMovedAt ?? item.createdAt;

  const remove = async () => {
    const go = async () => {
      await getItemService().deleteItem(item.id);
      void useApp.getState().syncNow();
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('item.deleteTitle', { name: item.name }))) await go();
      return;
    }
    Alert.alert(t('item.deleteTitle', { name: item.name }), t('item.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <Screen
      back
      testID="item-details"
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            name="edit"
            label={t('common.edit')}
            onPress={() => {
              const dr = useDraft.getState();
              dr.start('edit', item.id);
              dr.setFields({
                name: item.name,
                nameEn: item.nameEn ?? '',
                category: item.category,
                color: item.color,
                keywords: item.keywords.join('، '),
                tags: item.tags,
                notes: item.notes ?? '',
              });
              router.push('/add/item');
            }}
          />
          <IconButton
            name="heart"
            testID="item-favorite"
            label={item.favorite ? t('item.unfavorite') : t('item.favorite')}
            tint={item.favorite ? c.danger : undefined}
            onPress={() => {
              haptic('light');
              void getItemService().setFavorite(item.id, !item.favorite);
            }}
          />
        </View>
      }
    >
      <GlassCard padding={12} radius={radius.xl}>
        <ItemImage image={shown} category={item.category} cutout={view === 'cutout' && Boolean(cutout)} radius={radius.lg} />
        {cutout && original ? (
          <View style={{ marginTop: space.sm }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'cutout', label: t('add.showCutout') },
                { value: 'original', label: t('add.showOriginal') },
              ]}
            />
          </View>
        ) : null}
      </GlassCard>

      <View style={{ gap: 6 }}>
        <Txt variant="display" testID="item-name">
          {item.name}
        </Txt>
        {item.nameEn ? <Txt tone="secondary">{item.nameEn}</Txt> : null}
        <View style={styles.wrap}>
          <Chip label={t(`categories.${item.category}`)} icon={CATEGORY_ICON[item.category] as IconName} />
          {item.color ? <Chip label={t(`colors.${item.color}`)} swatch={COLOR_SWATCH[item.color]} /> : null}
          {item.tags.map((tag) => (
            <Chip key={tag} label={t(`tags.${tag}`, { defaultValue: tag })} />
          ))}
        </View>
      </View>

      <GlassCard padding={space.lg} radius={radius.xl} testID="item-place">
        <View style={{ gap: space.sm }}>
          <Txt variant="micro" tone="accent">
            {t('item.lastPlace')}
          </Txt>
          {placeImage ? <ItemImage image={placeImage} radius={radius.lg} placeholderIcon="pin" style={{ aspectRatio: 4 / 3 }} /> : null}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="pin" size={22} color={c.accentText} />
            <Txt variant="headline" style={{ flex: 1 }} testID="item-place-label">
              {placeLabel(place, t)}
            </Txt>
          </View>
          {place?.note ? <Txt tone="secondary">{place.note}</Txt> : null}
          <Txt variant="caption" tone="secondary">
            {t('item.recorded', { when: relativeTime(when, lang) })} · {formatDate(when, lang)}
          </Txt>
          <Txt variant="caption" tone="tertiary">
            {t('item.disclaimer')}
          </Txt>
          <Button
            title={t('item.movedIt')}
            icon="move"
            onPress={() => {
              useDraft.getState().start('move', item.id);
              router.push('/add/place');
            }}
            testID="item-move"
          />
          <Button kind="glass" title={t('item.history')} icon="history" onPress={() => router.push(`/item/${item.id}/history`)} testID="item-history" />
        </View>
      </GlassCard>

      {item.keywords.length || item.notes ? (
        <GlassCard padding={space.lg}>
          <Txt variant="headline">{t('item.details')}</Txt>
          {item.keywords.length ? <Txt tone="secondary">{item.keywords.join('، ')}</Txt> : null}
          {item.notes ? <Txt>{item.notes}</Txt> : null}
          {item.source !== 'manual' ? (
            <Txt variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
              {t('item.aiMade')}
            </Txt>
          ) : null}
        </GlassCard>
      ) : null}

      <GlassCard padding={space.md}>
        <Row icon="trash" title={t('item.delete')} danger onPress={() => void remove()} testID="item-delete" />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
