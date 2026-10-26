import { router } from 'expo-router';
import { Pause, Play, Radio, SkipBack, SkipForward, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { StarMark } from '@/components/brand';
import { IconButton, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

import { usePlayer } from './player';

export function MiniPlayer() {
  const t = useTheme();
  const { tr } = useI18n();
  const p = usePlayer();
  if (!p.now) return null;
  const title =
    p.now.kind === 'quran' ? `سورة ${p.now.surahName}${p.now.ayah ? ` — ${tr('آية', 'Ayah')} ${p.now.ayah}` : ''}` : p.now.title;
  const subtitle =
    p.now.kind === 'quran' ? p.now.reciterName : p.now.kind === 'stream' ? p.now.subtitle : tr('حصن المسلم', 'Hisn al-Muslim');
  return (
    <Pressable
      onPress={() => router.push('/player')}
      accessibilityLabel={tr('فتح المشغل', 'Open player')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: t.colors.fill,
        borderRadius: 22,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.colors.border,
      }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        {p.now.kind === 'stream' ? <Radio size={20} color="#fff" /> : <StarMark size={30} color="#FFFFFF" fill="none" strokeWidth={8} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="caption" weight="semibold" color="#FFFFFF" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="label" color="rgba(255,255,255,0.75)" numberOfLines={1}>
          {p.error ? tr('تعذر التشغيل — تحقق من الاتصال', 'Playback failed — check your connection') : subtitle}
        </Txt>
      </View>
      {p.now.kind === 'quran' ? (
        <IconButton icon={SkipForward} label={tr('الآية السابقة', 'Previous ayah')} tone="plain" size={36} color="#FFFFFF" onPress={() => p.stepAyah(-1)} />
      ) : null}
      {p.buffering && !p.playing ? (
        <ActivityIndicator color="#fff" style={{ width: 36 }} />
      ) : (
        <Pressable onPress={p.toggle} accessibilityLabel={p.playing ? tr('إيقاف مؤقت', 'Pause') : tr('تشغيل', 'Play')} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          {p.playing ? <Pause size={18} color={t.colors.primaryDeep} fill={t.colors.primaryDeep} /> : <Play size={18} color={t.colors.primaryDeep} fill={t.colors.primaryDeep} />}
        </Pressable>
      )}
      {p.now.kind === 'quran' ? (
        <IconButton icon={SkipBack} label={tr('الآية التالية', 'Next ayah')} tone="plain" size={36} color="#FFFFFF" onPress={() => p.stepAyah(1)} />
      ) : null}
      <Pressable onPress={p.stop} accessibilityLabel={tr('إغلاق المشغل', 'Close player')} hitSlop={8} style={{ padding: 4 }}>
        <X size={18} color="rgba(255,255,255,0.8)" />
      </Pressable>
    </Pressable>
  );
}
