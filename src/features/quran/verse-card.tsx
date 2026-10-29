// A verse in a list (text and reference), opening the mushaf at it.
import { router } from 'expo-router';
import { memo } from 'react';

import { QuranText, Tap, Txt } from '@/components/ui';
import type { Surah, Verse } from '@/data/content';
import { toArabicDigits } from '@/lib/arabic';
import { useTheme } from '@/theme';

export const VerseCard = memo(function VerseCard({ verse, surah, size = 21 }: { verse: Verse; surah: Surah | undefined; size?: number }) {
  const t = useTheme();
  return (
    <Tap onPress={() => router.push(`/mushaf?verse=${verse.id}`)} style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
      <QuranText size={size}>{`${verse.textQpc} ${toArabicDigits(verse.ayah)}`}</QuranText>
      <Txt variant="caption" muted>
        {`سورة ${surah?.name ?? ''}: ${verse.ayah}`}
      </Txt>
    </Tap>
  );
});
