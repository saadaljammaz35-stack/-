import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BookOpen, Check, ChevronDown, Copy, Heart, Pause, Share2, Volume2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Badge, IconButton, QuranText, ReadingText, Txt } from '@/components/ui';
import type { DhikrItem } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { openShare } from '@/features/home/daily-cards';
import { useI18n } from '@/i18n';
import { gradeTone } from '@/lib/hadith-grades';
import { useSettings } from '@/store/settings';
import { useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

export function DhikrCard({ item, count, onCount, index }: { item: DhikrItem; count: number; onCount?: () => void; index?: number }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  const favorites = useAdhkarStore((s) => s.favorites);
  const toggleFavorite = useAdhkarStore((s) => s.toggleFavorite);
  const haptics = useSettings((s) => s.haptics);
  const player = usePlayer();
  const done = count >= item.repeat;
  const fav = favorites.includes(item.key);
  const playingThis = player.now?.kind === 'clip' && player.now.url === item.audio && player.playing;

  const tap = () => {
    if (!onCount || done) return;
    onCount();
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(count + 1 >= item.repeat ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  if (item.kind === 'surah') {
    return (
      <Pressable onPress={() => router.push({ pathname: '/mushaf', params: { surah: String(item.surahId), ayah: '1' } })} style={{ backgroundColor: t.colors.surface, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BookOpen size={22} color={t.colors.primaryDeep} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold">{item.text}</Txt>
          <Txt variant="caption" muted>
            {item.reference}
          </Txt>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: 20, overflow: 'hidden', opacity: done ? 0.6 : 1, borderWidth: 1, borderColor: done ? t.colors.primary : t.colors.border }}>
      <Pressable onPress={tap} disabled={!onCount} style={{ padding: 16, gap: 10 }} accessibilityHint={onCount ? tr('اضغط للعدّ', 'Tap to count') : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {index != null ? (
            <Txt variant="label" muted>
              {index + 1}
            </Txt>
          ) : null}
          {item.by ? <Badge label={item.by} /> : null}
          {item.grade ? <Badge label={item.grade} tone={gradeTone(item.grade)} /> : null}
          <View style={{ flex: 1 }} />
          {item.repeatLabel || item.repeat > 1 ? <Badge label={item.repeatLabel ?? tr(`${item.repeat} مرات`, `${item.repeat} times`)} tone="other" /> : null}
        </View>
        {item.isQuran ? (
          <QuranText size={t.rs(22)} style={{ textAlign: 'right' }}>
            {item.text}
          </QuranText>
        ) : (
          <ReadingText size={20}>{item.text}</ReadingText>
        )}
        {item.fadl ? (
          <View style={{ backgroundColor: t.colors.primarySoft, borderRadius: 12, padding: 10 }}>
            <Txt variant="caption" color={t.colors.primaryDeep}>
              {item.fadl}
            </Txt>
          </View>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 10, gap: 4 }}>
        {onCount ? (
          <Pressable
            onPress={tap}
            accessibilityLabel={tr('العدّاد', 'Counter')}
            style={{ minWidth: 76, height: 40, borderRadius: 20, backgroundColor: done ? t.colors.primary : t.colors.primaryDeep, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}>
            {done ? <Check size={18} color="#fff" /> : null}
            <Txt weight="bold" color="#FFFFFF" style={{ writingDirection: 'ltr' }}>
              {`${Math.min(count, item.repeat)} / ${item.repeat}`}
            </Txt>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {item.audio ? (
          <IconButton
            icon={playingThis ? Pause : Volume2}
            label={tr('استماع', 'Listen')}
            tone="plain"
            size={38}
            onPress={() => (playingThis ? player.toggle() : player.playClip(item.audio!, item.chapterTitle ?? tr('ذكر', 'Dhikr')))}
          />
        ) : null}
        <IconButton icon={Heart} label={tr('المفضلة', 'Favourite')} tone="plain" size={38} color={fav ? t.colors.danger : undefined} onPress={() => toggleFavorite(item.key)} />
        <IconButton icon={Copy} label={tr('نسخ', 'Copy')} tone="plain" size={38} onPress={() => Clipboard.setStringAsync(`${item.text}\n— ${item.reference}`)} />
        <IconButton icon={Share2} label={tr('مشاركة', 'Share')} tone="plain" size={38} onPress={() => openShare({ title: item.chapterTitle ?? tr('ذكر', 'Dhikr'), text: item.text, reference: item.reference, quran: item.isQuran })} />
      </View>
      {item.reference || item.footnotes.length ? (
        <Pressable onPress={() => setOpen((o) => !o)} style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="caption" weight="semibold" color={t.colors.primary}>
              {tr('المصدر والتخريج', 'Source & takhrij')}
            </Txt>
            <ChevronDown size={16} color={t.colors.primary} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
          </View>
          {open ? (
            item.footnotes.length ? (
              item.footnotes.map((f, i) => (
                <Txt key={i} variant="caption" muted>
                  {`(${i + 1}) ${f}`}
                </Txt>
              ))
            ) : (
              <Txt variant="caption" muted>
                {item.reference}
              </Txt>
            )
          ) : (
            <Txt variant="caption" muted numberOfLines={1}>
              {item.reference}
            </Txt>
          )}
          {open && item.explanation ? (
            <Txt variant="caption">{item.explanation}</Txt>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
