import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Bookmark, BookOpen, CloudRain, ExternalLink, HandCoins, LocateFixed, MapPin, Moon, Pencil, Plane, Search, Settings, Sunrise, Tv, Wind, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { TabScreen } from '@/components/screen';
import { Button, Card, ForwardChevron, IconCircle, ProgressBar, SectionHeader, Tap, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { DailyCards } from '@/features/home/daily-cards';
import { DailyRing } from '@/features/home/daily-ring';
import { SkyHero } from '@/features/home/sky-hero';
import { locateDevice } from '@/features/location';
import { PrayerGrid } from '@/features/prayer/prayer-grid';
import { SHORTCUTS } from '@/features/shortcuts';
import { refreshWeather, useWeather } from '@/features/weather';
import { useNow, usePrayerInfo, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, toHijri } from '@/lib/hijri';
import { hifzStats } from '@/lib/hifz';
import { status as khatmaStatus, TOTAL_PAGES } from '@/lib/khatma';
import { computeDay, prayerLabel, type PlaceLocation, type PrayerSettings } from '@/lib/prayer-times';
import { bannerState } from '@/lib/ramadan';
import { civilDateIn, digits, formatDurationWords, zonedParts } from '@/lib/time';
import { SEASONS, seasonOn, VIRTUES, virtuesOn } from '@/lib/virtues';
import { distanceKm } from '@/lib/geo';
import { TRAVEL_KM } from '@/lib/travel';
import { useSettings } from '@/store/settings';
import { useActivityStore, useAdhkarStore, useHifzStore, useKhatmaStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

function greeting(hour: number, tr: (a: string, e: string) => string): string {
  if (hour < 4) return tr('ليلة طيبة', 'Peaceful night');
  if (hour < 12) return tr('صباح الخير', 'Good morning');
  if (hour < 17) return tr('وقت مبارك', 'Blessed day');
  return tr('مساء الخير', 'Good evening');
}

/** Ramadan, Eid and the day's virtue or season, shown on the sky (prayer countdowns are already there). */
/** From an hour before Fajr until an hour after sunrise: when someone is likely just awake. */
function wakingWindow(now: Date, location: PlaceLocation, prayer: PrayerSettings): boolean {
  const day = computeDay(civilDateIn(now, location.timezone), location, prayer);
  return now.getTime() >= day.times.fajr.getTime() - 3_600_000 && now.getTime() <= day.times.sunrise.getTime() + 3_600_000;
}

function SeasonChip({ now }: { now: Date }) {
  const { tr, lang } = useI18n();
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const style = useSettings((s) => s.digits);
  const home = useSettings((s) => s.home);
  const weatherOn = useSettings((s) => s.weatherAdhkar);
  const weather = useWeather((s) => s.weather);
  const f = useFormat();
  const wokeToday = useAdhkarStore((s) => Object.keys(s.progress[civilKey(civilDateIn(now, location?.timezone ?? 'UTC'))] ?? {}).some((k) => k.startsWith('situation:waking|')));
  useEffect(() => {
    if (weatherOn) refreshWeather();
  }, [weatherOn, location]);
  if (!location) return null;
  let Icon = Moon;
  const sky = weatherOn && weather ? (weather.thunder ? 'thunder' : weather.rain ? 'rain' : weather.wind ? 'wind' : null) : null;
  const b = bannerState(now, location, prayer);
  let text: string;
  let value: ReactNode = null;
  let route = '/ramadan';
  if (b.kind === 'before-ramadan') {
    text = tr('باقٍ على رمضان', 'Until Ramadan');
    value = tr(`${digits(b.daysLeft, style)} يومًا`, `${b.daysLeft} days`);
  } else if (b.kind === 'ramadan') {
    text = b.phase === 'until-iftar' ? tr(`اليوم ${b.day} من رمضان — الإفطار بعد`, `Ramadan day ${b.day} — iftar in`) : tr(`اليوم ${b.day} من رمضان — الإمساك بعد`, `Ramadan day ${b.day} — imsak in`);
    value = <Countdown target={b.target.getTime()} digits={style} variant="caption" weight="bold" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }} />;
  } else if (b.kind === 'eid') {
    text = tr(`عيد ${b.name} مبارك — ${prayerLabel(b.next.id, false)} بعد`, `Eid Mubarak — ${f.prayer(b.next.id)} in`);
    value = formatDurationWords(b.next.at.getTime() - now.getTime());
  } else if (wakingWindow(now, location, prayer) && !wokeToday) {
    // Around Fajr, until the waking adhkar are said.
    route = '/adhkar/situation:waking';
    Icon = Sunrise;
    text = tr('صباح الخير — أذكار الاستيقاظ', 'Good morning — the waking adhkar');
  } else if (sky) {
    // Rain, thunder or wind where the user is: its dua.
    route = `/adhkar/situation:${sky}`;
    Icon = sky === 'wind' ? Wind : CloudRain;
    text = { thunder: tr('رعد الآن — دعاء الرعد', 'Thunder now — its dua'), rain: tr('تمطر الآن — اللهم صيّبًا نافعًا', 'Rain now — its dua'), wind: tr('ريح الآن — دعاء الريح', 'Wind now — its dua') }[sky];
  } else if (home && distanceKm(home.lat, home.lng, location.lat, location.lng) >= TRAVEL_KM) {
    // Away from home: shortening and combining.
    route = '/travel';
    Icon = Plane;
    text = tr(`مسافر في ${location.name} — القصر والجمع`, `Travelling in ${location.name} — shortening and combining`);
  } else {
    // Otherwise today's virtue or season, if any.
    const today = civilDateIn(now, location.timezone);
    const season = seasonOn(today, prayer.hijriOffset);
    const virtue = virtuesOn(today, prayer.hijriOffset)[0];
    if (!season && !virtue) return null;
    route = '/virtues';
    const pick = (x: { ar: string; en: string }) => (lang === 'en' ? x.en : x.ar);
    text = season ? `${pick(SEASONS[season.id].title)} — ${tr(`اليوم ${digits(season.day, style)}`, `day ${season.day}`)}` : `${pick(VIRTUES[virtue].title)} — ${pick(VIRTUES[virtue].note)}`;
  }
  return (
    <Tap onPress={() => router.push(route as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(20,32,20,0.26)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 4 }}>
      <Icon size={16} color="#FFFFFF" />
      <Txt variant="caption" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </Txt>
      {typeof value === 'string' ? (
        <Txt variant="caption" weight="bold" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Txt>
      ) : (
        value
      )}
    </Tap>
  );
}
function LocationPrompt() {
  const { tr } = useI18n();
  const set = useSettings((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const useGps = async () => {
    setBusy(true);
    setError(null);
    const res = await locateDevice(true);
    setBusy(false);
    if (res.ok) set({ location: res.place });
    else setError(res.reason === 'denied' ? tr('لم يُمنح إذن الموقع. يمكنك اختيار مدينتك يدويًا.', 'Location permission denied. Choose your city instead.') : tr('تعذر تحديد الموقع.', 'Could not get your location.'));
  };
  return (
    <Card style={{ marginHorizontal: 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconCircle icon={MapPin} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold">{tr('حدّد موقعك لعرض مواقيت الصلاة', 'Set your location for prayer times')}</Txt>
          <Txt variant="caption" muted>
            {tr('يُستخدم الموقع على جهازك فقط لحساب المواقيت والقبلة.', 'Your location stays on your device.')}
          </Txt>
        </View>
      </View>
      {error ? (
        <Txt variant="caption" color="#B4533F">
          {error}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title={tr('استخدام موقعي', 'Use my location')} icon={LocateFixed} onPress={useGps} loading={busy} style={{ flex: 1 }} />
        <Button title={tr('اختيار مدينة', 'Choose city')} tone="soft" onPress={() => router.push('/location')} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function ContinueReading() {
  const t = useTheme();
  const { tr } = useI18n();
  const lastRead = useQuranStore((s) => s.lastRead);
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const hifzCards = useHifzStore((s) => s.cards);
  const today = useToday();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  const active = khatmas.find((k) => k.status === 'active');
  const cards: { key: string; title: string; subtitle: string; progress: number; onPress: () => void }[] = [];
  if (lastRead && surahs.length) {
    const surah = [...surahs].reverse().find((s) => s.pageStart <= lastRead.page) ?? surahs[0];
    cards.push({
      key: 'last',
      title: tr('متابعة المصحف من حيث توقفت', 'Continue where you left off'),
      subtitle: `${surah.name} — ${tr('الصفحة', 'Page')} ${lastRead.page}`,
      progress: lastRead.page / TOTAL_PAGES,
      onPress: () => router.push({ pathname: '/mushaf', params: { page: String(lastRead.page) } }),
    });
  }
  if (active) {
    const s = khatmaStatus(active, today);
    cards.push({
      key: 'khatma',
      title: active.name,
      subtitle: s.today && s.today.to > active.progress ? tr(`ورد اليوم: ${s.today.from}–${s.today.to}`, `Today: pages ${s.today.from}–${s.today.to}`) : tr('أتممت ورد اليوم', 'Today’s portion done'),
      progress: active.progress / TOTAL_PAGES,
      onPress: () => router.push({ pathname: '/khatma/[id]', params: { id: active.id } }),
    });
  }
  const hifz = hifzStats(hifzCards, today);
  if (hifz.due) {
    cards.push({
      key: 'hifz',
      title: tr('مراجعة الحفظ', 'Memorisation review'),
      subtitle: tr(`${hifz.due} آية حان موعد مراجعتها`, `${hifz.due} verses are due`),
      progress: hifz.memorised / 6236,
      onPress: () => router.push({ pathname: '/hifz/session', params: { mode: 'review' } }),
    });
  }
  if (!cards.length) {
    cards.push({
      key: 'start',
      title: tr('ابدأ القراءة', 'Start reading'),
      subtitle: tr('سورة الفاتحة — الصفحة 1', 'Al-Fatihah — page 1'),
      progress: 0,
      onPress: () => router.push({ pathname: '/mushaf', params: { page: '1' } }),
    });
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
      {cards.map((c) => (
        <Card key={c.key} onPress={c.onPress} style={{ width: 320 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={28} color={t.colors.primaryDeep} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt weight="semibold" color={t.colors.primaryDeep} numberOfLines={1}>
                {c.title}
              </Txt>
              <Txt variant="caption" muted>
                {c.subtitle}
              </Txt>
              <ProgressBar value={c.progress} />
            </View>
            <ForwardChevron />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function Shortcuts() {
  const t = useTheme();
  const { tr } = useI18n();
  const ids = useSettings((s) => s.shortcuts);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
      {ids.map((id) => {
        const s = SHORTCUTS.find((x) => x.id === id);
        if (!s) return null;
        return (
          <Tap key={id} onPress={() => router.push(s.route as never)} style={{ width: 92, alignItems: 'center', gap: 8 }} accessibilityLabel={tr(s.ar, s.en)}>
            <IconCircle icon={s.icon as LucideIcon} size={80} tint={t.colors.tints[s.tint]} iconSize={30} />
            <Txt variant="caption" center numberOfLines={2}>
              {tr(s.ar, s.en)}
            </Txt>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

function RecentActivity() {
  const t = useTheme();
  const { tr } = useI18n();
  const items = useActivityStore((s) => s.items);
  if (!items.length) return null;
  return (
    <View>
      <View style={{ paddingHorizontal: 20 }}>
        <SectionHeader title={tr('أنشطتك الأخيرة', 'Recent activity')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
        {items.map((a, i) => (
          <Pressable
            key={a.key}
            onPress={() => router.push(a.route as never)}
            style={{ backgroundColor: t.colors.tints[(i + 1) % 6], borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, maxWidth: 260 }}>
            <Txt weight="medium" numberOfLines={1}>
              {a.title}
            </Txt>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HaramainLive() {
  const t = useTheme();
  const { tr } = useI18n();
  const tiles = [
    { id: 'makkah', ar: 'المسجد الحرام', en: 'Masjid al-Haram', sub: tr('مكة المكرمة', 'Makkah') },
    { id: 'madinah', ar: 'المسجد النبوي', en: 'Masjid an-Nabawi', sub: tr('المدينة المنورة', 'Madinah') },
  ];
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <SectionHeader title={tr('البث المباشر من الحرمين', 'Live from the Two Holy Mosques')} action={tr('الإذاعات', 'Radio')} onAction={() => router.push('/live')} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tiles.map((x) => (
          <Card key={x.id} tone="primary" style={{ flex: 1, gap: 6 }} onPress={() => router.push({ pathname: '/live', params: { channel: x.id } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' }} />
              <Txt variant="label" weight="semibold" color="rgba(255,255,255,0.9)">
                {tr('مباشر', 'LIVE')}
              </Txt>
            </View>
            <Txt weight="semibold" color="#FFFFFF">
              {tr(x.ar, x.en)}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="caption" color="rgba(255,255,255,0.8)">
                {x.sub}
              </Txt>
              <Tv size={18} color={t.colors.highlight} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function EhsanBanner() {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <Card tone="primary" style={{ marginHorizontal: 20 }} onPress={() => router.push('/donate')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="subheading" weight="semibold" color="#FFFFFF">
            {tr('بادر بالإحسان', 'Give charity')}
          </Txt>
          <Txt variant="caption" color="rgba(255,255,255,0.85)">
            {tr('تبرّع عبر منصة «إحسان» الوطنية الرسمية للعمل الخيري', 'Donate via the official Ehsan national platform')}
          </Txt>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <Pressable
              onPress={() => Linking.openURL('https://ehsan.sa')}
              style={{ backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>
                {tr('تبرع الآن', 'Donate')}
              </Txt>
              <ExternalLink size={14} color={t.colors.primaryDeep} />
            </Pressable>
          </View>
        </View>
        <HandCoins size={56} color="rgba(255,255,255,0.9)" strokeWidth={1.3} />
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  // The screen refreshes every minute (never in the middle of a scroll) and exactly when the
  // next prayer begins; the countdowns tick on their own, so the sky and cards are not
  // redrawn every second.
  const [nextAt, setNextAt] = useState<number | undefined>(undefined);
  const now = useNow(60_000, nextAt, { yieldToScroll: true });
  const today = useToday(now);
  const location = useSettings((s) => s.location);
  const info = usePrayerInfo(now);
  const upcoming = info?.next.at.getTime();
  if (upcoming !== nextAt) setNextAt(upcoming);
  const hour = location ? zonedParts(now, location.timezone).hour : now.getHours();
  const f = useFormat();
  const hijriOffset = useSettings((s) => s.prayer.hijriOffset);
  const digitStyle = useSettings((s) => s.digits);
  const pathname = usePathname();

  return (
    <TabScreen
      title={tr('الرئيسية', 'Home')}
      hero={
        <SkyHero
          now={now}
          info={info}
          greeting={greeting(hour, tr)}
          dateLine={`${f.weekday(today)} · ${f.hijri(toHijri(today, hijriOffset))} · ${f.civil(today)}`}
          city={location ? [location.name, location.country].filter(Boolean).join('، ') : null}
          nextLabel={info ? tr(`صلاة ${f.prayer(info.next.id, info.next.day.isFriday)} بعد`, `${f.prayer(info.next.id, info.next.day.isFriday)} in`) : null}
          countdownTarget={info ? info.next.at.getTime() : null}
          digits={digitStyle}
          labels={{ sunrise: f.prayer('sunrise'), dhuhr: f.prayer('dhuhr', info?.day.isFriday), asr: f.prayer('asr'), maghrib: f.prayer('maghrib') }}
          footer={<SeasonChip now={now} />}
        />
      }
      actions={[
        { icon: Search, label: tr('البحث', 'Search'), onPress: () => router.push('/search') },
        { icon: Bookmark, label: tr('المحفوظات', 'Saved'), onPress: () => router.push('/saved') },
        { icon: Settings, label: tr('الإعدادات', 'Settings'), onPress: () => router.push('/settings') },
      ]}>
      <View style={{ gap: 26, marginTop: 20 }}>
        {info ? (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Txt variant="heading" weight="bold" color={t.colors.primaryDeep}>
                {tr('أوقات الصلاة', 'Prayer times')}
              </Txt>
              <Tap onPress={() => router.push('/location')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <MapPin size={16} color={t.colors.textMuted} />
                <Txt variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>
                  {[location?.name, location?.country].filter(Boolean).join('، ')}
                </Txt>
              </Tap>
            </View>
            <Tap onPress={() => router.push('/prayer')}>
              <PrayerGrid day={info.day} next={info.next} now={now} />
            </Tap>
            <View style={{ marginTop: 14 }}>
              <DailyRing today={today} day={info.day} now={now} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <LocationPrompt />
            <View style={{ paddingHorizontal: 20 }}>
              <DailyRing today={today} day={null} now={now} />
            </View>
          </View>
        )}

        <View>
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Txt variant="heading" weight="bold" color={t.colors.primaryDeep}>
              {tr('تطبيقاتك اليومية', 'Your daily tools')}
            </Txt>
            <Tap onPress={() => router.push('/settings/home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt variant="caption" muted>
                {tr('تخصيص', 'Customize')}
              </Txt>
              <Pencil size={16} color={t.colors.textMuted} />
            </Tap>
          </View>
          <Shortcuts />
        </View>

        <ContinueReading />
        <HaramainLive />
        <RecentActivity />
        <EhsanBanner />
        <View style={{ paddingHorizontal: 20 }}>
          <DailyCards today={today} />
        </View>
      </View>
      {pathname === '/' ? <StatusBar style="light" /> : null}
    </TabScreen>
  );
}
