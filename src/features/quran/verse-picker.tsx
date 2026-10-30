// Choosing a verse: step through surahs and verses, or type its key («2:255»).
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Card, IconButton, Txt } from '@/components/ui';
import { parseVerseKey, type Surah } from '@/data/content';
import { inputStyle } from '@/features/group-ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export type VerseRef = { surah: number; ayah: number };

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function Stepper({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) {
  const { tr, isRTL } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt muted style={{ width: 56 }}>
        {label}
      </Txt>
      <IconButton icon={isRTL ? ChevronRight : ChevronLeft} label={tr('السابق', 'Previous')} size={36} onPress={onPrev} />
      <Txt weight="semibold" center style={{ flex: 1 }} numberOfLines={1}>
        {value}
      </Txt>
      <IconButton icon={isRTL ? ChevronLeft : ChevronRight} label={tr('التالي', 'Next')} size={36} onPress={onNext} />
    </View>
  );
}

export function VersePicker({ surahs, value, onChange, ayahOnly = false }: { surahs: Surah[]; value: VerseRef; onChange: (v: VerseRef) => void; ayahOnly?: boolean }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [key, setKey] = useState('');
  const surah = surahs[value.surah - 1];
  const count = surah?.versesCount ?? 7;
  const setSurah = (n: number) => onChange({ surah: ((n - 1 + 114) % 114) + 1, ayah: 1 });
  const setAyah = (n: number) => onChange({ surah: value.surah, ayah: Math.min(count, Math.max(1, n)) });

  return (
    <Card style={{ gap: 10 }}>
      {ayahOnly ? null : <Stepper label={tr('السورة', 'Surah')} value={surah ? `${surah.id}. ${surah.name}` : String(value.surah)} onPrev={() => setSurah(value.surah - 1)} onNext={() => setSurah(value.surah + 1)} />}
      <Stepper label={tr('الآية', 'Verse')} value={`${value.ayah} / ${count}`} onPrev={() => setAyah(value.ayah - 1)} onNext={() => setAyah(value.ayah + 1)} />
      {ayahOnly ? null : (
        <TextInput
          value={key}
          onChangeText={(s) => {
            setKey(s);
            const k = parseVerseKey(toLatinDigits(s));
            if (k && k.ayah <= (surahs[k.surah - 1]?.versesCount ?? 0)) onChange(k);
          }}
          placeholder={tr('أو اكتب رقم السورة:الآية، مثل 2:255', 'Or type surah:verse, e.g. 2:255')}
          placeholderTextColor={t.colors.textFaint}
          keyboardType="numbers-and-punctuation"
          style={[inputStyle(t), { textAlign: 'center' }]}
        />
      )}
    </Card>
  );
}
