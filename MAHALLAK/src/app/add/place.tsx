import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CameraCapture, type Captured } from '@/components/CameraCapture';
import { ItemImage } from '@/components/ItemImage';
import { Screen } from '@/components/Screen';
import { Banner, Button, Chip, Field, GlassCard, Txt, haptic } from '@/design/Glass';
import { radius, space } from '@/design/tokens';
import { ROOM_IDS } from '@/domain/categories';
import { storePhoto } from '@/services/media/imageService';
import { ValidationError } from '@/services/itemService';
import { useApp } from '@/state/appStore';
import { useDraft } from '@/state/draft';
import { getItemService } from '@/state/services';

/** Step 2 (and "move"): photograph the place, pick the room, describe the exact spot. */
export default function AddPlace() {
  const { t } = useTranslation();
  const d = useDraft();
  const places = useApp((s) => s.places);
  const items = useApp((s) => s.items);
  const images = useApp((s) => s.images);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotError, setSpotError] = useState<string | null>(null);
  const moving = d.mode === 'move';
  const movingItem = moving ? items.find((i) => i.id === d.itemId) : null;

  const recentPlaces = useMemo(
    () => [...places].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8),
    [places],
  );

  const onPhoto = async (img: Captured) => {
    d.patch({ placePhoto: await storePhoto(img.uri, 'location', img) });
    d.setPlace({ placeId: null });
  };

  const save = async () => {
    setError(null);
    if (!d.place.placeId && !d.place.spot.trim()) {
      setSpotError(t('place.spotRequired'));
      return;
    }
    setSaving(true);
    try {
      const svc = getItemService();
      let imageId: string | null = null;
      if (d.placePhoto) imageId = (await svc.saveImage({ ...d.placePhoto, remotePath: null })).id;
      const placement = d.place.placeId
        ? { placeId: d.place.placeId }
        : { newPlace: { room: d.place.room, roomLabel: d.place.roomLabel, spot: d.place.spot, note: d.place.note, imageId } };

      if (moving && d.itemId) {
        await svc.moveItem(d.itemId, placement);
        haptic('success');
        router.back();
        return;
      }
      if (d.original) await svc.saveImage({ ...d.original, remotePath: null });
      if (d.cutout) await svc.saveImage({ ...d.cutout, remotePath: null });
      const item = await svc.createItem(
        {
          name: d.fields.name,
          nameEn: d.fields.nameEn,
          category: d.fields.category,
          color: d.fields.color,
          keywords: d.fields.keywords.split(/[،,]/),
          tags: d.fields.tags,
          notes: d.fields.notes,
          originalImageId: d.original?.id ?? null,
          cutoutImageId: d.cutout?.id ?? null,
          source: d.ai ? 'ai_single' : 'manual',
        },
        placement,
      );
      haptic('success');
      void useApp.getState().syncNow();
      router.dismissAll();
      router.push(`/item/${item.id}`);
    } catch (e) {
      setError(e instanceof ValidationError ? t('place.spotRequired') : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen back title={moving ? t('place.moveTitle', { name: movingItem?.name ?? '' }) : t('place.title')} testID="add-place">
      {!moving ? (
        <Txt variant="caption" tone="accent">
          {t('add.stepPlace')}
        </Txt>
      ) : null}

      {recentPlaces.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Txt variant="caption" tone="secondary">
            {t('place.existing')}
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label={t('place.newPlace')} icon="plus" selected={!d.place.placeId} onPress={() => d.setPlace({ placeId: null })} testID="place-new" />
            {recentPlaces.map((p) => (
              <Chip key={p.id} label={p.spot} icon="pin" selected={d.place.placeId === p.id} onPress={() => d.setPlace({ placeId: p.id })} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {d.place.placeId ? (
        (() => {
          const p = places.find((x) => x.id === d.place.placeId);
          return p ? (
            <GlassCard padding={12}>
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <ItemImage image={p.imageId ? images[p.imageId] : null} size={72} radius={radius.md} placeholderIcon="pin" />
                <View style={{ flex: 1 }}>
                  <Txt variant="headline">{p.spot}</Txt>
                  <Txt variant="caption" tone="secondary">
                    {p.roomLabel || t(`rooms.${p.room}`)}
                  </Txt>
                </View>
              </View>
            </GlassCard>
          ) : null;
        })()
      ) : (
        <>
          {d.placePhoto ? (
            <GlassCard padding={12} radius={radius.xl}>
              <ItemImage image={{ ...d.placePhoto, remotePath: null, createdAt: '' }} radius={radius.lg} />
              <Button kind="glass" icon="camera" title={t('add.retake')} onPress={() => d.patch({ placePhoto: null })} style={{ marginTop: space.sm }} />
            </GlassCard>
          ) : (
            <CameraCapture onCaptured={(img) => void onPhoto(img)} hint={t('place.photoHint')} testID="place-camera" />
          )}
          <GlassCard padding={space.lg} radius={radius.xl}>
            <View style={{ gap: space.md }}>
              <View style={{ gap: 6 }}>
                <Txt variant="caption" tone="secondary">
                  {t('place.room')}
                </Txt>
                <View style={styles.wrap}>
                  {ROOM_IDS.map((r) => (
                    <Chip key={r} testID={`room-${r}`} label={t(`rooms.${r}`)} selected={d.place.room === r} onPress={() => d.setPlace({ room: r })} />
                  ))}
                </View>
              </View>
              <Field
                label={t('place.spot')}
                placeholder={t('place.spotPlaceholder')}
                value={d.place.spot}
                onChangeText={(spot) => (setSpotError(null), d.setPlace({ spot }))}
                error={spotError}
                testID="place-spot"
              />
              <Field
                label={`${t('place.roomLabel')} (${t('common.optional')})`}
                placeholder={t('place.roomLabelPlaceholder')}
                value={d.place.roomLabel}
                onChangeText={(roomLabel) => d.setPlace({ roomLabel })}
              />
              <Field label={`${t('place.note')} (${t('common.optional')})`} value={d.place.note} onChangeText={(note) => d.setPlace({ note })} />
            </View>
          </GlassCard>
        </>
      )}

      {error ? <Banner tone="danger" icon="close" text={error} /> : null}
      <Button size="lg" title={moving ? t('place.saveMove') : t('place.saveItem')} onPress={() => void save()} loading={saving} icon="check" testID="place-save" />
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
