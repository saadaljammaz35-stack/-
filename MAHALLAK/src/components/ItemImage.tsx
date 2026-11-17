import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORY_ICON, type CategoryId } from '@/domain/categories';
import type { ImageRef } from '@/domain/models';
import { Icon, type IconName } from '@/design/Icon';
import { useTheme } from '@/design/theme';
import { getSupabase } from '@/services/supabase';
import { BUCKETS } from '@/services/sync/syncService';

const signed = new Map<string, { url: string; exp: number }>();

/** Local file first; on a new device, a short-lived signed URL from the private bucket. */
function useImageUri(ref: ImageRef | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(ref?.localUri ?? null);
  useEffect(() => {
    if (!ref) return setUri(null);
    if (ref.localUri) return setUri(ref.localUri);
    if (!ref.remotePath) return setUri(null);
    const cached = signed.get(ref.remotePath);
    if (cached && cached.exp > Date.now()) return setUri(cached.url);
    const client = getSupabase();
    if (!client) return setUri(null);
    let alive = true;
    const bucket = ref.kind === 'location' ? BUCKETS.location : BUCKETS.item;
    client.storage
      .from(bucket)
      .createSignedUrl(ref.remotePath, 3600)
      .then(({ data }) => {
        if (!data?.signedUrl || !alive) return;
        signed.set(ref.remotePath!, { url: data.signedUrl, exp: Date.now() + 3500_000 });
        setUri(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [ref?.id, ref?.localUri, ref?.remotePath]);
  return uri;
}

export function ItemImage({
  image,
  category,
  size,
  radius = 18,
  cutout,
  style,
  placeholderIcon,
}: {
  image: ImageRef | null | undefined;
  category?: CategoryId;
  size?: number;
  radius?: number;
  /** Render a background-removed PNG on a soft pedestal. */
  cutout?: boolean;
  style?: StyleProp<ViewStyle>;
  placeholderIcon?: IconName;
}) {
  const { c, isDark } = useTheme();
  const uri = useImageUri(image);
  const box: ViewStyle = size ? { width: size, height: size } : { width: '100%', aspectRatio: 1 };
  return (
    <View style={[box, { borderRadius: radius, overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={isDark ? ['#1C4A3E', '#0F3027'] : ['#FFFFFF', '#EFE5D2']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {uri ? (
        <Image
          source={{ uri }}
          style={cutout ? { position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '8%' } : StyleSheet.absoluteFill}
          contentFit={cutout ? 'contain' : 'cover'}
          transition={180}
          recyclingKey={image?.id}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name={placeholderIcon ?? ((category ? CATEGORY_ICON[category] : 'box') as IconName)} size={size ? size * 0.4 : 44} color={c.accentText} />
        </View>
      )}
    </View>
  );
}
