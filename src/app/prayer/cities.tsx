// «مواقيت مدن أهلي»: the prayer times of the cities where family and friends live, on one screen —
// their local time, the next prayer there and today's five times.
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { Screen } from '@/components/screen';
import { Card, IconButton, Txt } from '@/components/ui';
import { CityPicker } from '@/features/city-picker';
import { useNow } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { computeDay, nextPrayer, SALAH_IDS, type PlaceLocation } from '@/lib/prayer-times';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

function CityCard({ place, onRemove }: { place: PlaceLocation; onRemove: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const now = useNow(30_000);
  const settings = useSettings((s) => s.prayer);
  const digits = useSettings((s) => s.digits);
  const day = computeDay(civilDateIn(now, place.timezone), place, settings);
  const next = nextPrayer(now, place, settings);

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Txt weight="bold">{place.name}</Txt>
          <Txt variant="caption" muted>
            {tr(`الساعة هناك ${f.time(now, place.timezone)}`, `Local time ${f.time(now, place.timezone)}`)}
            {place.country ? ` · ${place.country}` : ''}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="caption" muted>
            {tr(`${f.prayer(next.id, day.isFriday && next.id === 'dhuhr')} بعد`, `${f.prayer(next.id)} in`)}
          </Txt>
          <Countdown target={next.at.getTime()} digits={digits} color={t.colors.primary} style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }} />
        </View>
        <IconButton icon={Trash2} label={tr('إزالة', 'Remove')} tone="plain" size={36} onPress={onRemove} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {SALAH_IDS.map((id) => (
          <View key={id} style={{ alignItems: 'center', gap: 2, flex: 1, paddingVertical: 6, borderRadius: 10, backgroundColor: id === next.id ? t.colors.primarySoft : 'transparent' }}>
            <Txt variant="label" muted>
              {f.prayer(id, day.isFriday && id === 'dhuhr')}
            </Txt>
            <Txt variant="caption" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
              {f.time(day.times[id], place.timezone)}
            </Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

export default function FamilyCities() {
  const { tr } = useI18n();
  const cities = useSettings((s) => s.familyCities ?? []);
  const set = useSettings((s) => s.set);
  const [key, setKey] = useState(0);

  const add = (p: PlaceLocation) => {
    if (!cities.some((c) => c.lat === p.lat && c.lng === p.lng)) set({ familyCities: [...cities, p].slice(0, 12) });
    setKey((k) => k + 1);
  };

  return (
    <Screen title={tr('مواقيت مدن أهلي', 'Family cities')} subtitle={tr('مواقيت من تحب في مدنهم، في شاشة واحدة', 'Prayer times where your loved ones live')}>
      <Card style={{ gap: 8 }}>
        <CityPicker key={key} label={tr('أضف مدينة', 'Add a city')} value={null} onChange={add} />
      </Card>
      {cities.map((c) => (
        <CityCard key={`${c.lat},${c.lng}`} place={c} onRemove={() => set({ familyCities: cities.filter((x) => x !== c) })} />
      ))}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('محسوبة بطريقة الحساب التي اخترتها في الإعدادات، وقد يعتمد أهل كل بلد طريقة أو تقويمًا آخر.', 'Computed with the calculation method you chose in settings; each country may follow another method or timetable.')}
      </Txt>
    </Screen>
  );
}
