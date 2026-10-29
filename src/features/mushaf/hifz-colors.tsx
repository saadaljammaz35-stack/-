// The memorisation colours of the mushaf: each memorised verse tinted by how firmly it is held.
import { useMemo } from 'react';
import { View } from 'react-native';

import { Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { strengthMap, type HifzStrength } from '@/lib/hifz';
import { useHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

const TINTS: Record<HifzStrength, { light: string; dark: string }> = {
  strong: { light: '#DCEFD6', dark: '#24402A' },
  growing: { light: '#EEF3C9', dark: '#3A4120' },
  weak: { light: '#FBE3C2', dark: '#4A3519' },
  due: { light: '#F8D3CC', dark: '#4E2623' },
};

const LABELS: Record<HifzStrength, { ar: string; en: string }> = {
  strong: { ar: 'ثابت', en: 'Strong' },
  growing: { ar: 'يقوى', en: 'Growing' },
  weak: { ar: 'ضعيف', en: 'Weak' },
  due: { ar: 'راجعه اليوم', en: 'Review today' },
};

/** Verse id → background colour, or null when the colours are off. */
export function useHifzTints(enabled: boolean): Record<number, string> | null {
  const cards = useHifzStore((s) => s.cards);
  const today = useToday();
  const dark = useTheme().colors.scheme === 'dark';
  return useMemo(() => {
    if (!enabled) return null;
    const out: Record<number, string> = {};
    for (const [id, s] of Object.entries(strengthMap(cards, today))) out[Number(id)] = dark ? TINTS[s].dark : TINTS[s].light;
    return out;
  }, [enabled, cards, today, dark]);
}

export function HifzLegend() {
  const t = useTheme();
  const { lang } = useI18n();
  const dark = t.colors.scheme === 'dark';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
      {(['strong', 'growing', 'weak', 'due'] as HifzStrength[]).map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: dark ? TINTS[s].dark : TINTS[s].light, borderWidth: 1, borderColor: t.colors.border }} />
          <Txt variant="caption" muted>
            {lang === 'en' ? LABELS[s].en : LABELS[s].ar}
          </Txt>
        </View>
      ))}
    </View>
  );
}
