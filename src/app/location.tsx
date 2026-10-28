import { router } from 'expo-router';
import { LocateFixed, MapPin, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { listPerf } from '@/components/list';
import { searchCities, type City } from '@/data/content';
import { locateDevice } from '@/features/location';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

export default function LocationScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const location = useSettings((s) => s.location);
  const set = useSettings((s) => s.set);
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => searchCities(query).then(setCities), 150);
    return () => clearTimeout(id);
  }, [query]);

  const gps = async () => {
    setBusy(true);
    setError(null);
    const res = await locateDevice(true);
    setBusy(false);
    if (res.ok) {
      set({ location: res.place });
      router.back();
    } else {
      setError(res.reason === 'denied' ? tr('لم يُمنح إذن الموقع. يمكنك تفعيله من إعدادات الجهاز أو اختيار مدينة.', 'Permission denied. Enable it in system settings or pick a city.') : tr('تعذر تحديد موقعك الآن.', 'Could not determine your location.'));
    }
  };

  const choose = (c: City) => {
    set({ location: { name: c.name, country: c.country_name, lat: c.lat, lng: c.lng, timezone: c.timezone, source: 'manual' } });
    router.back();
  };

  return (
    <Screen title={tr('الموقع', 'Location')} scroll={false}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        {location ? (
          <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MapPin size={20} color={t.colors.primaryDeep} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold">{[location.name, location.country].filter(Boolean).join('، ')}</Txt>
              <Txt variant="caption" muted>{`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} — ${location.timezone}`}</Txt>
            </View>
          </Card>
        ) : null}
        <Button title={tr('تحديد موقعي تلقائيًا', 'Use my current location')} icon={LocateFixed} onPress={gps} loading={busy} />
        {error ? (
          <Txt variant="caption" color={t.colors.danger}>
            {error}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('ابحث عن مدينة (بالعربية أو الإنجليزية)', 'Search a city')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, minWidth: 0, paddingVertical: 11, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }}
          />
        </View>
      </View>
      <FlatList
        {...listPerf}
        data={cities}
        keyExtractor={(c) => String(c.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => choose(item)} style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' })}>
            <Txt weight="medium">{item.name}</Txt>
            <Txt variant="caption" muted>{`${item.country_name} — ${item.name_en}`}</Txt>
          </Pressable>
        )}
        ListFooterComponent={
          <Txt variant="label" muted center style={{ padding: 16 }}>
            {tr('قائمة المدن من GeoNames (CC BY 4.0)', 'City list from GeoNames (CC BY 4.0)')}
          </Txt>
        }
      />
    </Screen>
  );
}
