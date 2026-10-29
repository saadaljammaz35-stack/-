// «خطة القضاء»: the prayers and fasts owed, spread over a daily plan the user can keep.
import { Check, Minus, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, Group, IconButton, ProgressBar, Txt } from '@/components/ui';
import { getVerseByKey, getSurahs, type Surah, type Verse } from '@/data/content';
import { Evidence } from '@/features/hadith/evidence';
import { VerseCard } from '@/features/quran/verse-card';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, daysBetween, toGregorian, toHijri } from '@/lib/hijri';
import { FARD_IDS } from '@/lib/prayer-log';
import { fastPlanDates, prayerPlanDays } from '@/lib/qada';
import { useSettings } from '@/store/settings';
import { usePrayerLogStore, useQadaStore } from '@/store/user';
import { useTheme } from '@/theme';

/** «من نسي صلاة فليصل إذا ذكرها» (Bukhari and Muslim). */
const FORGOT_HADITH = 65088;
/** Aisha made up her Ramadan fasts in Sha‘ban (Bukhari and Muslim). */
const SHABAN_HADITH = 65504;
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export default function QadaScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const qada = usePrayerLogStore((s) => s.qada);
  const adjustQada = usePrayerLogStore((s) => s.adjustQada);
  const plan = useQadaStore();
  const [verse, setVerse] = useState<{ verse: Verse | null; surahs: Surah[] } | null>(null);
  useEffect(() => {
    Promise.all([getVerseByKey(2, 184), getSurahs()]).then(([v, surahs]) => setVerse({ verse: v, surahs }));
  }, []);

  const owed = FARD_IDS.reduce((n, id) => n + qada[id], 0);
  const days = prayerPlanDays(qada, plan.perPrayer);
  const done = plan.today.date === civilKey(today) ? plan.today.done : {};
  // Today's share of each prayer: as many as planned, or what was left of it this morning.
  const todayTarget = FARD_IDS.reduce((n, id) => n + Math.min(qada[id] + (done[id] ?? 0), plan.perPrayer), 0);
  const doneToday = FARD_IDS.reduce((n, id) => n + Math.min(done[id] ?? 0, plan.perPrayer), 0);
  const madeUp = (id: (typeof FARD_IDS)[number]) => {
    adjustQada(id, -1);
    plan.madeUp(today, id);
  };

  const fastDates = fastPlanDates(today, plan.fastsOwed, plan.fastWeekdays, offset);
  const h = toHijri(today, offset);
  const nextRamadan = toGregorian({ year: h.month >= 9 ? h.year + 1 : h.year, month: 9, day: 1 }, offset);
  const lastFast = fastDates[fastDates.length - 1];
  const afterRamadan = lastFast ? daysBetween(nextRamadan, lastFast) >= 0 : false;

  return (
    <Screen title={tr('خطة القضاء', 'Make-up plan')} subtitle={tr('ما فاتك من صلاة أو صيام، على جدول يناسبك', 'Missed prayers and fasts, on a schedule you can keep')}>
      <Card tone="primary" style={{ gap: 10 }}>
        <Txt variant="subheading" color="#FFFFFF">
          {owed ? tr(`عليك ${owed} صلاة`, `${owed} prayers owed`) : tr('لا صلوات عليك في سجلك', 'No prayers owed in your log')}
        </Txt>
        {owed ? (
          <>
            <Txt color="rgba(255,255,255,0.9)">
              {tr(`مع كل فريضة تصليها، اقضِ معها:`, 'With each daily prayer, make up:')}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 5].map((n) => (
                <Chip key={n} label={tr(`${n}`, `${n}`)} active={plan.perPrayer === n} onPress={() => plan.set({ perPrayer: n })} onPrimary />
              ))}
            </View>
            <Txt color={t.colors.highlight} weight="semibold">
              {tr(`تنتهي خلال ${days} يوم، في ${f.civil(addCivilDays(today, days))}`, `Done in ${days} days, by ${f.civil(addCivilDays(today, days))}`)}
            </Txt>
            <ProgressBar value={todayTarget ? doneToday / todayTarget : 0} color={t.colors.highlight} />
            <Txt variant="caption" color="rgba(255,255,255,0.85)">
              {tr(`اليوم: قضيت ${doneToday} من ${todayTarget}`, `Today: ${doneToday} of ${todayTarget}`)}
            </Txt>
          </>
        ) : null}
      </Card>

      {owed ? (
        <Card padded={false}>
          {FARD_IDS.map((id, i) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <Txt weight="medium" style={{ flex: 1 }}>
                {f.prayer(id)}
              </Txt>
              <Txt muted>{tr(`${qada[id]} متبقية`, `${qada[id]} left`)}</Txt>
              <Button title={tr('قضيت واحدة', 'Made one up')} icon={Check} tone="soft" disabled={!qada[id]} onPress={() => madeUp(id)} />
            </View>
          ))}
        </Card>
      ) : null}
      <Txt variant="caption" muted center>
        {tr('تُضاف الصلاة هنا حين تسجّلها «فاتتني» في «صلاتي»، ويمكنك تعديل العدد من هناك.', 'A prayer is added here when you mark it missed in My prayers; adjust counts there.')}
      </Txt>
      <Evidence id={FORGOT_HADITH} />

      <Group title={tr('الصيام', 'Fasts')}>
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt weight="semibold" style={{ flex: 1 }}>
              {tr('أيام عليك قضاؤها', 'Days to make up')}
            </Txt>
            <IconButton icon={Minus} label={tr('أنقص', 'Less')} size={36} disabled={!plan.fastsOwed} onPress={() => plan.set({ fastsOwed: Math.max(0, plan.fastsOwed - 1) })} />
            <Txt variant="heading" style={{ minWidth: 34, textAlign: 'center' }}>
              {plan.fastsOwed}
            </Txt>
            <IconButton icon={Plus} label={tr('زد', 'More')} size={36} onPress={() => plan.set({ fastsOwed: plan.fastsOwed + 1 })} />
          </View>
          <Txt variant="caption" muted>
            {tr('أيام الصيام في الأسبوع:', 'Fasting days each week:')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map((w) => (
              <Chip
                key={w}
                label={f.weekdayShort(w)}
                active={plan.fastWeekdays.includes(w)}
                onPress={() => plan.set({ fastWeekdays: plan.fastWeekdays.includes(w) ? plan.fastWeekdays.filter((x) => x !== w) : [...plan.fastWeekdays, w].sort() })}
              />
            ))}
          </View>
          {plan.fastsOwed && lastFast ? (
            <>
              <Txt>
                {tr(`أقرب أيامك: ${fastDates.slice(0, 3).map((d) => `${f.weekday(d)} ${f.civil(d)}`).join('، ')}`, `Next: ${fastDates.slice(0, 3).map((d) => `${f.weekday(d)} ${f.civil(d)}`).join(', ')}`)}
              </Txt>
              <Txt weight="semibold" color={afterRamadan ? t.colors.danger : t.colors.primary}>
                {afterRamadan
                  ? tr(`تنتهي ${f.civil(lastFast)}، بعد دخول رمضان القادم. زد أيام الأسبوع لتنتهي قبله.`, `Done ${f.civil(lastFast)}, after next Ramadan begins. Add days to finish before it.`)
                  : tr(`تنتهي ${f.civil(lastFast)}، قبل رمضان القادم.`, `Done ${f.civil(lastFast)}, before next Ramadan.`)}
              </Txt>
              <Button title={tr('صمت يومًا من القضاء', 'I fasted a make-up day')} icon={Check} tone="soft" onPress={() => plan.set({ fastsOwed: Math.max(0, plan.fastsOwed - 1) })} />
            </>
          ) : null}
          <Txt variant="caption" muted>
            {tr('لا يُجدول القضاء في رمضان ولا يوم العيد ولا أيام التشريق، ولا الجمعة وحدها.', 'Never scheduled in Ramadan, on Eid, the days of Tashreeq, or a Friday on its own.')}
          </Txt>
        </View>
      </Group>
      {verse?.verse ? <VerseCard verse={verse.verse} surah={verse.surahs[verse.verse.surah - 1]} size={19} /> : null}
      <Evidence id={SHABAN_HADITH} />
    </Screen>
  );
}
