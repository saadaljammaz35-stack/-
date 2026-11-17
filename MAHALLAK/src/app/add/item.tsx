import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CameraCapture, type Captured } from '@/components/CameraCapture';
import { ItemImage } from '@/components/ItemImage';
import { Screen } from '@/components/Screen';
import { PLAN } from '@/config/plans';
import { Banner, Button, Chip, Field, GlassCard, Segmented, Txt, haptic } from '@/design/Glass';
import type { IconName } from '@/design/Icon';
import { radius, space } from '@/design/tokens';
import { CATEGORY_ICON, CATEGORY_IDS, COLOR_IDS, COLOR_SWATCH } from '@/domain/categories';
import { AiError, recognizeItem, removeBackground } from '@/services/ai/aiClient';
import { photoForAi, storeCutout, storePhoto } from '@/services/media/imageService';
import { useApp } from '@/state/appStore';
import { useDraft } from '@/state/draft';
import { getItemService } from '@/state/services';

const TAGS = ['travel', 'camping', 'school'] as const;

/**
 * Step 1: photograph the item. The original is always kept; background removal
 * and recognition run in parallel when the user enabled AI, and every
 * suggestion stays editable.
 */
export default function AddItem() {
  const { t, i18n } = useTranslation();
  const d = useDraft();
  const canAdd = useApp((s) => s.canAddItem());
  const [view, setView] = useState<'cutout' | 'original'>('cutout');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = d.mode === 'edit';

  const onCaptured = async (img: Captured) => {
    const original = await storePhoto(img.uri, 'item_original', img);
    d.patch({ original, cutout: null, ai: null });
    const state = useApp.getState();
    if (!state.session || !state.settings.aiConsent || !state.online) {
      d.patch({ aiStatus: 'off', bgStatus: 'kept' });
      return;
    }
    d.patch({ aiStatus: 'working', bgStatus: 'working' });
    let b64: string;
    try {
      b64 = await photoForAi(img.uri, img);
    } catch {
      d.patch({ aiStatus: 'failed', bgStatus: 'kept' });
      return;
    }
    const gate = state.aiGate();
    await Promise.all([
      removeBackground(gate, b64)
        .then(async (png) => d.patch({ cutout: await storeCutout(png), bgStatus: 'done' }))
        .catch(() => d.patch({ bgStatus: 'kept' })),
      recognizeItem(gate, b64, i18n.language)
        .then((ai) => {
          const f = useDraft.getState().fields;
          d.patch({ ai, aiStatus: 'done' });
          d.setFields({
            name: f.name || (i18n.language === 'en' ? ai.nameEn || ai.nameAr : ai.nameAr),
            nameEn: f.nameEn || ai.nameEn,
            category: f.category === 'other' ? ai.category : f.category,
            color: f.color ?? ai.color,
            keywords: f.keywords || ai.keywords.join('، '),
          });
        })
        .catch((e) => d.patch({ aiStatus: e instanceof AiError && e.code === 'quota_exceeded' ? 'quota' : 'failed' })),
    ]);
  };

  const next = async () => {
    if (!d.fields.name.trim()) {
      setNameError(t('add.nameRequired'));
      return;
    }
    if (!editing) {
      router.push('/add/place');
      return;
    }
    setSaving(true);
    try {
      const svc = getItemService();
      const patch: Parameters<typeof svc.updateItem>[1] = {
        name: d.fields.name,
        nameEn: d.fields.nameEn,
        category: d.fields.category,
        color: d.fields.color,
        keywords: d.fields.keywords.split(/[،,]/),
        tags: d.fields.tags,
        notes: d.fields.notes,
      };
      if (d.original) {
        await svc.saveImage({ ...d.original, remotePath: null });
        patch.originalImageId = d.original.id;
        patch.cutoutImageId = null;
      }
      if (d.cutout) {
        await svc.saveImage({ ...d.cutout, remotePath: null });
        patch.cutoutImageId = d.cutout.id;
      }
      await svc.updateItem(d.itemId!, patch);
      haptic('success');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const preview = view === 'cutout' && d.cutout ? d.cutout : d.original;
  const showCamera = !d.original && !editing;

  return (
    <Screen back title={editing ? t('common.edit') : t('add.title')} testID="add-item">
      {!editing ? (
        <Txt variant="caption" tone="accent">
          {t('add.stepItem')}
        </Txt>
      ) : null}
      {!canAdd && !editing ? (
        <Banner tone="warning" icon="lock" text={t('add.limitReached', { max: PLAN.free.maxItems })} action={t('profile.upgrade')} onAction={() => router.push('/purchase')} />
      ) : null}

      {showCamera ? (
        <>
          <CameraCapture onCaptured={(img) => void onCaptured(img)} hint={t('add.takePhoto')} aspect={1} testID="item-camera" />
          <Button kind="ghost" title={t('add.noPhoto')} onPress={() => d.patch({ aiStatus: 'off' })} testID="item-no-photo" />
        </>
      ) : d.original ? (
        <GlassCard padding={12} radius={radius.xl}>
          <ItemImage image={{ ...preview!, remotePath: null, createdAt: '' }} cutout={view === 'cutout' && Boolean(d.cutout)} radius={radius.lg} />
          <View style={styles.previewBar}>
            {d.cutout ? (
              <View style={{ flex: 1 }}>
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'cutout', label: t('add.showCutout') },
                    { value: 'original', label: t('add.showOriginal') },
                  ]}
                />
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Button kind="glass" icon="camera" title={t('add.retake')} onPress={() => d.patch({ original: null, cutout: null, aiStatus: 'idle', bgStatus: 'idle' })} />
          </View>
        </GlassCard>
      ) : null}

      {d.bgStatus === 'working' ? <Banner icon="sparkle" text={t('add.removingBg')} /> : null}
      {d.bgStatus === 'done' ? <Banner tone="success" icon="check" text={t('add.bgRemoved')} /> : null}
      {d.original && d.bgStatus === 'kept' && d.aiStatus !== 'off' ? <Banner icon="image" text={t('add.bgKept')} /> : null}
      {d.aiStatus === 'working' ? <Banner icon="sparkle" text={t('add.recognizing')} /> : null}
      {d.aiStatus === 'done' ? <Banner icon="sparkle" text={t('add.aiSuggestion')} /> : null}
      {d.aiStatus === 'off' && d.original ? <Banner icon="shield" text={t('add.aiOff')} action={t('profile.privacy')} onAction={() => router.push('/privacy')} /> : null}
      {d.aiStatus === 'failed' ? <Banner tone="warning" text={t('add.aiFailed')} /> : null}
      {d.aiStatus === 'quota' ? <Banner tone="warning" text={t('add.aiQuota')} /> : null}

      {(!showCamera || d.aiStatus === 'off') && (
        <GlassCard padding={space.lg} radius={radius.xl}>
          <View style={{ gap: space.md }}>
            <Field
              label={t('add.name')}
              placeholder={t('add.namePlaceholder')}
              value={d.fields.name}
              onChangeText={(name) => (setNameError(null), d.setFields({ name }))}
              error={nameError}
              testID="item-name"
            />
            <View style={{ gap: 6 }}>
              <Txt variant="caption" tone="secondary">
                {t('add.category')}
              </Txt>
              <View style={styles.wrap}>
                {CATEGORY_IDS.map((c) => (
                  <Chip
                    key={c}
                    testID={`cat-${c}`}
                    label={t(`categories.${c}`)}
                    icon={CATEGORY_ICON[c] as IconName}
                    selected={d.fields.category === c}
                    onPress={() => d.setFields({ category: c })}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Txt variant="caption" tone="secondary">
                {t('add.color')}
              </Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {COLOR_IDS.map((col) => (
                  <Chip
                    key={col}
                    label={t(`colors.${col}`)}
                    swatch={COLOR_SWATCH[col]}
                    selected={d.fields.color === col}
                    onPress={() => d.setFields({ color: d.fields.color === col ? null : col })}
                  />
                ))}
              </ScrollView>
            </View>
            <Field label={t('add.keywords')} hint={t('add.keywordsHint')} value={d.fields.keywords} onChangeText={(keywords) => d.setFields({ keywords })} testID="item-keywords" />
            <View style={{ gap: 6 }}>
              <Txt variant="caption" tone="secondary">
                {t('add.tags')}
              </Txt>
              <View style={styles.wrap}>
                {TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={t(`tags.${tag}`)}
                    selected={d.fields.tags.includes(tag)}
                    onPress={() =>
                      d.setFields({ tags: d.fields.tags.includes(tag) ? d.fields.tags.filter((x) => x !== tag) : [...d.fields.tags, tag] })
                    }
                  />
                ))}
              </View>
            </View>
            <Field label={`${t('add.nameEn')} (${t('common.optional')})`} value={d.fields.nameEn} onChangeText={(nameEn) => d.setFields({ nameEn })} autoCapitalize="words" />
            <Field label={`${t('add.notes')} (${t('common.optional')})`} value={d.fields.notes} onChangeText={(notes) => d.setFields({ notes })} multiline />
          </View>
        </GlassCard>
      )}

      {(!showCamera || d.aiStatus === 'off') && (
        <Button
          size="lg"
          title={editing ? t('common.save') : t('add.toPlace')}
          onPress={() => void next()}
          loading={saving}
          disabled={(!canAdd && !editing) || d.aiStatus === 'working'}
          testID="item-next"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
