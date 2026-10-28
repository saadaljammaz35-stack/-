// «المساجد القريبة»: mosques around the user with distance and direction, and walking
// directions in the phone's maps app. Data: © OpenStreetMap contributors.
import { ArrowUp, LocateFixed, Map as MapIcon, MapPinned, RotateCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, Loading, Tap, Txt } from '@/components/ui';
import { devicePosition, fetchNearbyMosques, openDirections, openMosquesMap } from '@/features/mosques';
import { useI18n } from '@/i18n';
import { formatDistance, type Mosque } from '@/lib/mosques';
import { compassPoint } from '@/lib/qibla';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

type Origin = { lat: number; lng: number; fromDevice: boolean };

/** Where to search from (the device, else the chosen city) and what was found there. */
async function search(ask: boolean, city: { lat: number; lng: number } | null, lang: 'ar' | 'en'): Promise<{ origin: Origin | null; state: 'idle' | 'error' | Mosque[] }> {
  const here = await devicePosition(ask).catch(() => null);
  const origin = here ? { ...here, fromDevice: true } : city ? { lat: city.lat, lng: city.lng, fromDevice: false } : null;
  if (!origin) return { origin, state: 'idle' };
  try {
    return { origin, state: await fetchNearbyMosques(origin.lat, origin.lng, lang) };
  } catch {
    return { origin, state: 'error' };
  }
}

export default function MosquesScreen() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const location = useSettings((s) => s.location);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | Mosque[]>('loading');

  const apply = (r: Awaited<ReturnType<typeof search>>) => {
    setOrigin(r.origin);
    setState(r.state);
  };
  const load = (ask: boolean) => {
    setState('loading');
    search(ask, location, lang).then(apply);
  };

  useEffect(() => {
    let alive = true;
    search(false, location, lang).then((r) => {
      if (!alive) return;
      setOrigin(r.origin);
      setState(r.state);
    });
    return () => {
      alive = false;
    };
  }, [location, lang]);

  const unnamed = tr('مسجد', 'Mosque');
  return (
    <Screen
      title={tr('المساجد القريبة', 'Nearby mosques')}
      subtitle={origin ? (origin.fromDevice ? tr('حسب موقعك الحالي', 'From where you are') : tr(`حسب مدينة ${location?.name ?? ''}`, `Around ${location?.name ?? ''}`)) : undefined}
      actions={[
        ...(origin ? [{ icon: MapIcon, label: tr('على الخريطة', 'On the map'), onPress: () => openMosquesMap(origin.lat, origin.lng, lang) }] : []),
        { icon: RotateCw, label: tr('تحديث', 'Refresh'), onPress: () => load(false) },
      ]}>
      {origin && !origin.fromDevice ? (
        <Card tone="soft" style={{ gap: 10 }}>
          <Txt>{tr('تُعرض المساجد حول مدينتك المحددة. للأدق، استخدم موقعك الحالي.', 'Showing mosques around your chosen city. For the closest ones, use your current location.')}</Txt>
          <Button title={tr('استخدام موقعي الحالي', 'Use my location')} icon={LocateFixed} tone="soft" onPress={() => load(true)} />
        </Card>
      ) : null}

      {state === 'loading' ? <Loading label={tr('جارٍ البحث عن المساجد…', 'Finding mosques…')} /> : null}
      {state === 'idle' && !origin ? (
        <EmptyState icon={MapPinned} title={tr('حدّد موقعك أولًا', 'Set your location first')} message={tr('نحتاج موقعك أو مدينتك لنعرض المساجد القريبة.', 'We need your location or city to find mosques nearby.')} />
      ) : null}
      {state === 'error' ? (
        <Card style={{ gap: 10 }}>
          <Txt>{tr('تعذّر الوصول إلى خدمة الخرائط. تحقق من الاتصال وحاول مرة أخرى.', 'Could not reach the map service. Check your connection and try again.')}</Txt>
          <Button title={tr('إعادة المحاولة', 'Try again')} onPress={() => load(false)} />
        </Card>
      ) : null}
      {Array.isArray(state) && !state.length ? (
        <EmptyState icon={MapPinned} title={tr('لم نجد مساجد مسجّلة قريبة', 'No mapped mosques nearby')} message={tr('جرّب الخريطة، فقد تعرض أماكن غير مسجّلة هنا.', 'Try the map; it may know places that are not listed here.')} />
      ) : null}

      {Array.isArray(state) && state.length ? (
        <Card padded={false}>
          {state.map((m, i) => (
            <Tap key={m.id} onPress={() => openDirections(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ transform: [{ rotate: `${m.bearing}deg` }] }}>
                  <ArrowUp size={20} color={t.colors.primaryDeep} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold" numberOfLines={1}>
                  {m.name ?? unnamed}
                </Txt>
                <Txt variant="caption" muted>
                  {lang === 'en' ? `${formatDistance(m.km, 'en')} · ${Math.round(m.bearing)}°` : `${formatDistance(m.km)} · جهة ${compassPoint(m.bearing)}`}
                </Txt>
              </View>
              <Txt variant="caption" color={t.colors.primary}>
                {tr('الاتجاهات', 'Directions')}
              </Txt>
            </Tap>
          ))}
        </Card>
      ) : null}

      <Txt variant="caption" muted center>
        {tr('الاتجاه بالنسبة إلى الشمال. البيانات من خريطة الشارع المفتوحة © OpenStreetMap contributors، وقد لا تشمل كل المساجد.', 'Directions are from north. Data © OpenStreetMap contributors; it may not include every mosque.')}
      </Txt>
    </Screen>
  );
}
