// A city chosen by typing its name (Arabic or English), from the bundled city list.
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Tap, Txt } from '@/components/ui';
import { searchCities, type City } from '@/data/content';
import { useI18n } from '@/i18n';
import type { PlaceLocation } from '@/lib/prayer-times';
import { useTheme } from '@/theme';

export const cityPlace = (c: City): PlaceLocation => ({ name: c.name, country: c.country_name, lat: c.lat, lng: c.lng, timezone: c.timezone, source: 'manual' });

export function CityPicker({ label, value, onChange }: { label: string; value: PlaceLocation | null; onChange: (p: PlaceLocation) => void }) {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<City[]>([]);
  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) return;
    searchCities(query, 6).then((r) => alive && setResults(r));
    return () => {
      alive = false;
    };
  }, [query]);
  const shown = query.trim().length < 2 ? [] : results;

  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" muted>
        {label}
      </Txt>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={value ? `${value.name}${value.country ? `، ${value.country}` : ''}` : tr('اكتب اسم المدينة', 'Type a city')}
        placeholderTextColor={value ? t.colors.text : t.colors.textFaint}
        style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: lang === 'en' ? 'left' : 'right' }}
      />
      {shown.map((c) => (
        <Tap
          key={c.id}
          onPress={() => {
            onChange(cityPlace(c));
            setQuery('');
          }}
          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.colors.surfaceAlt }}
        >
          <Txt>{lang === 'en' ? `${c.name_en}, ${c.country}` : `${c.name}، ${c.country_name}`}</Txt>
        </Tap>
      ))}
    </View>
  );
}
