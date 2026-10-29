// A hadith quoted as evidence: its text (the opening, or all of it), source and grade; opens the
// full hadith with its explanation.
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Badge, Tap, Txt } from '@/components/ui';
import { getEncHadith, type EncHadith } from '@/data/content';
import { useI18n } from '@/i18n';
import { gradeTone } from '@/lib/hadith-grades';
import { useTheme } from '@/theme';

export function Evidence({ id, full }: { id: number; full?: boolean }) {
  const t = useTheme();
  const { isRTL } = useI18n();
  const [h, setH] = useState<EncHadith | null>(null);
  useEffect(() => {
    let alive = true;
    getEncHadith(id).then((x) => alive && setH(x));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!h) return null;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Tap onPress={() => router.push(`/hadith/enc/${h.id}`)} style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
      <Txt numberOfLines={full ? undefined : 3} style={{ lineHeight: 24 }}>
        {h.text}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Badge label={h.attribution.split('\n')[0]} />
        <Badge label={h.grade.split('\n')[0]} tone={gradeTone(h.grade)} />
        <View style={{ flex: 1 }} />
        <Chevron size={18} color={t.colors.textMuted} />
      </View>
    </Tap>
  );
}
