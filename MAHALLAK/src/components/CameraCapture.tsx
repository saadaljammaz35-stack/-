import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, GlassSurface, IconButton, Txt, haptic } from '@/design/Glass';
import { Icon } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';

export interface Captured {
  uri: string;
  width: number;
  height: number;
}

/**
 * Camera with a glass shutter. Always offers the photo library as a fallback:
 * when permission is denied, when the camera fails to start, or on devices
 * without a camera.
 */
export function CameraCapture({
  onCaptured,
  hint,
  aspect = 3 / 4,
  testID,
}: {
  onCaptured: (c: Captured) => void;
  hint?: string;
  aspect?: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
    const a = res.assets?.[0];
    if (!res.canceled && a) onCaptured({ uri: a.uri, width: a.width, height: a.height });
  };

  const shoot = async () => {
    if (!cam.current || !ready || busy) return;
    setBusy(true);
    haptic('light');
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.85, exif: false });
      if (photo) onCaptured({ uri: photo.uri, width: photo.width, height: photo.height });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const frame = { width: '100%' as const, aspectRatio: aspect, borderRadius: radius.xl, overflow: 'hidden' as const };

  if (!permission) return <View style={frame} />;

  if (!permission.granted || failed) {
    return (
      <GlassSurface weight="regular" radius={radius.xl} style={[frame, styles.center, { padding: space.xl, gap: space.md }]}>
        <Icon name="camera" size={40} color={c.accentText} />
        {failed ? (
          <Txt align="center" tone="secondary">
            {t('camera.failed')}
          </Txt>
        ) : (
          <>
            <Txt variant="headline" align="center">
              {t('camera.permissionTitle')}
            </Txt>
            <Txt align="center" tone="secondary">
              {t('camera.permissionBody')}
            </Txt>
            {permission.canAskAgain ? (
              <Button title={t('camera.allow')} onPress={() => void requestPermission()} testID="camera-allow" />
            ) : (
              <Button title={t('camera.openSettings')} kind="glass" onPress={() => void Linking.openSettings()} />
            )}
          </>
        )}
        <Button title={t('camera.library')} kind="glass" icon="image" onPress={() => void pick()} testID={`${testID ?? 'camera'}-library`} />
      </GlassSurface>
    );
  }

  return (
    <View style={{ gap: space.sm }} testID={testID}>
      <View style={frame}>
        <CameraView
          ref={cam}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setReady(true)}
          onMountError={() => setFailed(true)}
          animateShutter
        />
        {/* framing guide */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: 22, borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,253,247,0.55)' }]} />
        {hint ? (
          <View style={styles.hint} pointerEvents="none">
            <Banner text={hint} icon="sparkle" />
          </View>
        ) : null}
      </View>
      <View style={styles.controls}>
        <IconButton name="image" label={t('camera.library')} onPress={() => void pick()} testID={`${testID ?? 'camera'}-library`} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('camera.capture')}
          onPress={() => void shoot()}
          disabled={!ready || busy}
          testID={`${testID ?? 'camera'}-shutter`}
          style={({ pressed }) => [styles.shutterOuter, { borderColor: c.accent, opacity: ready ? 1 : 0.5, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <View style={[styles.shutterInner, { backgroundColor: c.primary }]} />
        </Pressable>
        {Platform.OS === 'web' ? (
          <View style={{ width: 44 }} />
        ) : (
          <IconButton name="refresh" label={t('camera.flip')} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', top: 14, left: 14, right: 14 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
});
