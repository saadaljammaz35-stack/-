// «الأيام الفاضلة»: today's virtues and season, tonight's last third, the coming occasions and
// their reminders. Every virtue is shown with the hadith that establishes it.
import { router } from 'expo-router';
import { BookOpen, CalendarHeart, MoonStar } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, Group, SwitchRow, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, hijriMonthName, toHijri } from '@/lib/hijri';
import { computeDay } from '@/lib/prayer-times';
import { NIGHT_HADITH, SEASONS, seasonOn, upcomingOccasions, VIRTUES, virtuesOn } from '@/lib/virtues';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const UPCOMING_DAYS = 30;

export default function VirtuesScreen() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const f = useFormat();
  const now = useNow(60_000);
  const today = useToday(now);
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const n = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);
  const offset = prayer.hijriOffset;

  const virtues = virtuesOn(today, offset);
  const season = seasonOn(today, offset);
  const upcoming = useMemo(() => upcomingOccasions(addCivilDays(today, 1), UPCOMING_DAYS, offset), [today, offset]);

  // Tonight's last third: before Fajr it is the night that began yesterday.
  const night = useMemo(() => {
    if (!location) return null;
    const day = computeDay(today, location, prayer);
    const ofNight = now < day.times.fajr ? computeDay(addCivilDays(today, -1), location, prayer) : day;
    const fajr = now < day.times.fajr ? day.times.fajr : computeDay(addCivilDays(today, 1), location, prayer).times.fajr;
    return { start: ofNight.lastThird, fajr, now: now >= ofNight.lastThird && now < fajr };
  }, [location, prayer, today, now]);

  const label = (x: { ar: string; en: string }) => (lang === 'en' ? x.en : x.ar);
  const next = upcoming[0];
  const nextName = next ? next.virtues.map((v) => label(VIRTUES[v].title)).join(lang === 'en' ? ', ' : '، ') || label(SEASONS[next.seasonStarts!].title) : null;

  return (
    <Screen title={tr('الأيام الفاضلة', 'Virtuous days')} subtitle={`${f.weekday(today)} · ${f.hijri(toHijri(today, offset))}`}>
      {season ? (
        <>
          <Card tone="primary" style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CalendarHeart size={20} color={t.colors.highlight} />
              <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
                {label(SEASONS[season.id].title)}
              </Txt>
              <Txt variant="caption" color="rgba(255,255,255,0.85)">
                {tr(`اليوم ${season.day}`, `Day ${season.day}`)}
              </Txt>
            </View>
            <Txt color="rgba(255,255,255,0.9)">{label(SEASONS[season.id].note)}</Txt>
          </Card>
          {SEASONS[season.id].hadith.map((id) => (
            <Evidence key={id} id={id} />
          ))}
        </>
      ) : null}

      {/* Within a season with nothing else today, the season card above says it all. */}
      {virtues.length || !season ? (
        <Card style={{ gap: 10 }}>
          <Txt weight="bold" color={t.colors.primaryDeep}>
            {tr('اليوم', 'Today')}
          </Txt>
          {virtues.length ? (
            virtues.map((v) => (
              <View key={v} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {label(VIRTUES[v].title)}
                  </Txt>
                  {VIRTUES[v].fast ? <Badge label={tr('يُستحب صيامه', 'Recommended fast')} tone="sahih" /> : null}
                </View>
                <Txt muted>{label(VIRTUES[v].note)}</Txt>
                {VIRTUES[v].hadith.map((id) => (
                  <Evidence key={id} id={id} />
                ))}
                {v === 'friday' ? <Button title={tr('اقرأ سورة الكهف', 'Read Surat al-Kahf')} icon={BookOpen} tone="soft" onPress={() => router.push('/mushaf?surah=18&ayah=1')} /> : null}
              </View>
            ))
          ) : (
            <Txt muted>
              {next && nextName
                ? tr(`لا مناسبة خاصة اليوم. أقرب مناسبة: ${nextName} (${f.weekday(next.date)})`, `Nothing special today. Next: ${nextName} (${f.weekday(next.date)})`)
                : tr('لا مناسبة خاصة اليوم.', 'Nothing special today.')}
            </Txt>
          )}
        </Card>
      ) : null}

      {night && location ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MoonStar size={20} color={t.colors.primary} />
            <Txt weight="bold" color={t.colors.primaryDeep} style={{ flex: 1 }}>
              {tr('قيام الليل', 'Night prayer')}
            </Txt>
            {night.now ? <Badge label={tr('الآن', 'Now')} tone="sahih" /> : null}
          </View>
          <Txt>
            {tr(
              `يبدأ الثلث الأخير من الليل ${f.time(night.start, location.timezone)} ويمتد إلى أذان الفجر ${f.time(night.fajr, location.timezone)}.`,
              `The last third of the night begins at ${f.time(night.start, location.timezone)} and lasts until Fajr at ${f.time(night.fajr, location.timezone)}.`,
            )}
          </Txt>
          <Evidence id={NIGHT_HADITH} />
          <SwitchRow title={tr('نبّهني عند بدايته كل ليلة', 'Remind me every night')} value={n.qiyam.enabled} onChange={(v) => setNotifications({ qiyam: { enabled: v } })} />
        </Card>
      ) : null}

      <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep} style={{ marginTop: 6 }}>
        {tr('القادم', 'Coming up')}
      </Txt>
      <Card padded={false}>
        {upcoming.map((o, i) => {
          const h = toHijri(o.date, offset);
          return (
            <View key={civilKey(o.date)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <View style={{ width: 104 }}>
                <Txt weight="semibold">{f.weekday(o.date)}</Txt>
                <Txt variant="caption" muted numberOfLines={1}>
                  {`${h.day} ${hijriMonthName(h.month, lang)}`}
                </Txt>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {o.seasonStarts ? <Badge label={label(SEASONS[o.seasonStarts].title)} tone="sahih" /> : null}
                {o.virtues.map((v) => (
                  <Badge key={v} label={label(VIRTUES[v].title)} tone={VIRTUES[v].fast ? 'soft' : 'other'} />
                ))}
              </View>
            </View>
          );
        })}
      </Card>

      <Group title={tr('التذكيرات', 'Reminders')}>
        <SwitchRow title={tr('صيام التطوع', 'Voluntary fasts')} subtitle={tr('مساء اليوم السابق', 'The evening before')} value={n.fasting.enabled} onChange={(v) => setNotifications({ fasting: { ...n.fasting, enabled: v } })} />
        <SwitchRow title={tr('المواسم', 'Seasons')} subtitle={tr('محرّم وشعبان والعشر الأواخر وست شوال وعشر ذي الحجة', 'Muharram, Sha‘ban, the last ten, Shawwal and Dhul-Hijjah')} value={n.seasons.enabled} onChange={(v) => setNotifications({ seasons: { enabled: v } })} />
        <SwitchRow title={tr('يوم الجمعة وسورة الكهف', 'Friday & Surat al-Kahf')} value={n.fridayKahf.enabled} onChange={(v) => setNotifications({ fridayKahf: { ...n.fridayKahf, enabled: v } })} />
      </Group>
      <Txt variant="caption" muted center>
        {tr('الأحاديث من موسوعة الأحاديث النبوية مع تخريجها ودرجتها. التواريخ بتقويم أم القرى مع تعديلك في الإعدادات.', 'Hadiths from the Encyclopedia of Translated Prophetic Hadiths, with source and grade. Dates follow Umm al-Qura with your adjustment.')}
      </Txt>
    </Screen>
  );
}
