import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { CameraCapture, type Captured } from '@/components/CameraCapture';
import { ItemImage } from '@/components/ItemImage';
import { Screen } from '@/components/Screen';
import { Banner, Button, Chip, Field, GlassCard, IconButton, Txt, haptic } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { ROOM_IDS, type RoomId } from '@/domain/categories';
import { AiError, detectItems, preselect, type RecognizedItem } from '@/services/ai/aiClient';
import { photoForAi, storePhoto, type StoredPhoto } from '@/services/media/imageService';
import { useApp } from '@/state/appStore';
import { getItemService } from '@/state/services';

type Candidate = RecognizedItem & { selected: boolean; name: string };

/**
 * SMART ROOM MEMORY: one photo of a drawer, shelf or box -> suggested items.
 * Nothing is saved until the user reviews the list; uncertain detections start
 * unselected and are saved only if the user picks them.
 */
export default function RoomScan() {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const session = useApp((s) => s.session);
  const aiConsent = useApp((s) => s.settings.aiConsent);
  const [photo, setPhoto] = useState<StoredPhoto | null>(null);
  const [phase, setPhase] = useState<'capture' | 'detecting' | 'review' | 'error'>('capture');
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Candidate[]>([]);
  const [room, setRoom] = useState<RoomId>('bedroom');
  const [spot, setSpot] = useState('');
  const [saving, setSaving] = useState(false);
  const allowed = Boolean(session && aiConsent);

  const onCaptured = async (img: Captured) => {
    const stored = await storePhoto(img.uri, 'location', img);
    setPhoto(stored);
    setPhase('detecting');
    try {
      const b64 = await photoForAi(img.uri, img);
      const found = await detectItems(useApp.getState().aiGate(), b64, i18n.language);
      setList(preselect(found).map((f) => ({ ...f, name: i18n.language === 'en' ? f.nameEn || f.nameAr : f.nameAr })));
      setPhase('review');
    } catch (e) {
      setError(e instanceof AiError && e.code === 'quota_exceeded' ? t('add.aiQuota') : t('add.aiFailed'));
      setPhase('error');
    }
  };

  const selected = list.filter((x) => x.selected && x.name.trim());

  const save = async () => {
    if (!photo || selected.length === 0) return;
    if (!spot.trim()) {
      setError(t('place.spotRequired'));
      return;
    }
    setSaving(true);
    try {
      const svc = getItemService();
      const image = await svc.saveImage({ ...photo, remotePath: null });
      const place = await svc.createPlace({ room, spot, imageId: image.id });
      for (const it of selected) {
        await svc.createItem(
          { name: it.name, nameEn: it.nameEn, category: it.category, color: it.color, keywords: it.keywords, source: 'ai_room' },
          { placeId: place.id },
        );
      }
      haptic('success');
      void useApp.getState().syncNow();
      router.replace('/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={t('roomScan.title')}
      right={<IconButton name="close" label={t('common.close')} onPress={() => router.back()} />}
      testID="room-scan"
    >
      <Txt tone="secondary">{t('roomScan.subtitle')}</Txt>

      {!allowed ? (
        <>
          <Banner tone="warning" icon="lock" text={t('roomScan.requiresAi')} />
          {!session ? (
            <Button title={t('profile.signIn')} onPress={() => router.push('/sign-in')} />
          ) : (
            <Button title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
          )}
        </>
      ) : phase === 'capture' ? (
        <CameraCapture onCaptured={(img) => void onCaptured(img)} hint={t('roomScan.capture')} testID="room-camera" />
      ) : (
        <>
          {photo ? <ItemImage image={{ ...photo, remotePath: null, createdAt: '' }} radius={radius.xl} style={{ aspectRatio: 4 / 3 }} /> : null}
          {phase === 'detecting' ? <Banner icon="sparkle" text={t('roomScan.detecting')} /> : null}
          {phase === 'error' && error ? (
            <>
              <Banner tone="warning" text={error} />
              <Button kind="glass" title={t('common.retry')} onPress={() => (setPhase('capture'), setPhoto(null), setError(null))} />
            </>
          ) : null}
          {phase === 'review' ? (
            list.length === 0 ? (
              <>
                <Banner tone="warning" text={t('roomScan.noneFound')} />
                <Button kind="glass" title={t('add.retake')} onPress={() => (setPhase('capture'), setPhoto(null))} />
              </>
            ) : (
              <>
                <Txt variant="headline">{t('roomScan.found', { count: list.length })}</Txt>
                <Banner icon="shield" text={t('roomScan.selectHint')} />
                {list.map((it, k) => (
                  <GlassCard key={k} padding={12} weight={it.selected ? 'regular' : 'thin'}>
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: it.selected }}
                        accessibilityLabel={it.name}
                        testID={`scan-check-${k}`}
                        onPress={() => setList((l) => l.map((x, j) => (j === k ? { ...x, selected: !x.selected } : x)))}
                        style={[styles.check, { borderColor: c.accent, backgroundColor: it.selected ? c.primary : 'transparent' }]}
                      >
                        {it.selected ? <Icon name="check" size={18} color={c.onPrimary} strokeWidth={2.4} /> : null}
                      </Pressable>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Field value={it.name} onChangeText={(name) => setList((l) => l.map((x, j) => (j === k ? { ...x, name } : x)))} />
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          <Chip label={t(`categories.${it.category}`)} />
                          {it.confidence < 0.75 ? <Chip label={`${t('roomScan.unsure')} · ${Math.round(it.confidence * 100)}%`} /> : null}
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                ))}
                <GlassCard padding={space.lg}>
                  <View style={{ gap: space.sm }}>
                    <Txt variant="headline">{t('roomScan.whereIsIt')}</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {ROOM_IDS.map((r) => (
                        <Chip key={r} label={t(`rooms.${r}`)} selected={room === r} onPress={() => setRoom(r)} />
                      ))}
                    </View>
                    <Field label={t('place.spot')} placeholder={t('place.spotPlaceholder')} value={spot} onChangeText={(v) => (setError(null), setSpot(v))} error={error} />
                  </View>
                </GlassCard>
                <Button size="lg" icon="check" title={t('roomScan.save', { count: selected.length })} disabled={selected.length === 0} loading={saving} onPress={() => void save()} testID="scan-save" />
              </>
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
