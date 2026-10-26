import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Heart, Share2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Badge, IconButton, ReadingText, Txt } from '@/components/ui';
import { openShare } from '@/features/home/daily-cards';
import { useI18n } from '@/i18n';
import { gradeTone } from '@/lib/hadith-grades';
import { useHadithStore } from '@/store/user';
import { useTheme } from '@/theme';

import { citation, type Hadith } from './books';

export function HadithCard({ h, compact, highlight }: { h: Hadith; compact?: boolean; highlight?: string }) {
  const t = useTheme();
  const { tr } = useI18n();
  const isFav = useHadithStore((s) => s.favorites.some((f) => f.kind === 'book' && f.book === h.book && f.n === h.n));
  const toggle = useHadithStore((s) => s.toggle);
  const cite = citation(h);
  return (
    <Pressable
      onPress={compact ? () => router.push({ pathname: '/hadith/view', params: { book: h.book, n: String(h.n) } }) : undefined}
      style={{ backgroundColor: t.colors.surface, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={cite} />
        {h.grades.slice(0, compact ? 1 : 4).map((g, i) => (
          <Badge key={i} label={`${g.by}: ${g.grade}`} tone={gradeTone(g.grade)} />
        ))}
      </View>
      <ReadingText size={compact ? 18 : 20} selectable={!compact}>
        {compact && h.text.length > 420 ? `${h.text.slice(0, 420)}…` : h.text}
      </ReadingText>
      {highlight ? (
        <Txt variant="label" muted>
          {highlight}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
        <IconButton icon={Heart} label={tr('المفضلة', 'Favourite')} tone="plain" size={36} color={isFav ? t.colors.danger : undefined} onPress={() => toggle({ kind: 'book', book: h.book, n: h.n }, cite)} />
        <IconButton icon={Copy} label={tr('نسخ', 'Copy')} tone="plain" size={36} onPress={() => Clipboard.setStringAsync(`${h.text}\n[${cite}]`)} />
        <IconButton icon={Share2} label={tr('مشاركة', 'Share')} tone="plain" size={36} onPress={() => openShare({ title: tr('حديث نبوي', 'Hadith'), text: h.text, reference: `${cite}${h.grades[0] ? ` — ${h.grades[0].by}: ${h.grades[0].grade}` : ''}` })} />
      </View>
    </Pressable>
  );
}
