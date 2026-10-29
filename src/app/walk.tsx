// «خطواتك إلى المسجد»: counts the steps on the way to the mosque, recalls their reward, and
// records the prayer as prayed in congregation on arrival.
import { router } from 'expo-router';
import { Footprints, Landmark, MapPin, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Pedometer } from 'expo-sensors';

import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, Row, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, usePrayerInfo, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { betweenState } from '@/lib/between';
import { addCivilDays, civilKey } from '@/lib/hijri';
import type { FardId } from '@/lib/prayer-log';
import { useSettings } from '@/store/settings';
import { usePrayerLogStore, useWalkStore } from '@/store/user';
import { useTheme } from '@/theme';

/** «لم يخطُ خطوة إلا رُفعت له بها درجة، وحُطّ عنه بها خطيئة» (Bukhari and Muslim). */
const STEPS_HADITH = 3435;
/** «دياركم تُكتب آثاركم» (Muslim). */
const FOOTPRINTS_HADITH = 3713;
/** Hisn al-Muslim: the dua on the way to the mosque. */
const GOING_CHAPTER = 12;

const pedometer = Platform.OS === 'web' ? null : Pedometer;

export default function WalkScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const now = useNow(30_000);
  const info = usePrayerInfo(now);
  const { walks, active, start, finish, cancel } = useWalkStore();
  const mark = usePrayerLogStore((s) => s.mark);
  const [available, setAvailable] = useState<boolean | null>(pedometer ? null : false);
  const [live, setLive] = useState(0);
  const [result, setResult] = useState<{ steps: number; prayer: FardId | null } | null>(null);

  useEffect(() => {
    pedometer?.isAvailableAsync().then(setAvailable, () => setAvailable(false));
  }, []);

  // While walking, count the steps since the start.
  useEffect(() => {
    if (!active || !pedometer) return;
    const sub = pedometer.watchStepCount((r) => setLive(r.steps));
    return () => sub.remove();
  }, [active]);

  const iqama = useSettings((s) => s.iqama);
  // The prayer being walked to: the one whose iqama is coming, or the next adhan.
  const state = info ? betweenState(now, info.next.previous ? { id: info.next.previous.id as FardId, at: info.next.previous.at } : null, { id: info.next.id as FardId, at: info.next.at }, iqama) : null;
  const prayer: FardId | null = state ? state.prayer : null;

  const begin = async () => {
    if (!pedometer) return;
    const p = await pedometer.requestPermissionsAsync();
    if (!p.granted) return;
    setLive(0);
    setResult(null);
    start(prayer);
  };

  const arrive = async () => {
    if (!active) return;
    let steps = live;
    // iOS keeps its own count, including while the phone was locked.
    if (Platform.OS === 'ios' && pedometer) {
      const r = await pedometer.getStepCountAsync(new Date(active.startedAt), new Date()).catch(() => null);
      if (r) steps = Math.max(steps, r.steps);
    }
    const walkingTo = active.prayer;
    finish(today, steps);
    if (walkingTo) mark(today, walkingTo, 'jamaah');
    setResult({ steps, prayer: walkingTo });
  };

  const week = walks.filter((w) => w.date >= civilKey(addCivilDays(today, -6)));
  const total = walks.reduce((n, w) => n + w.steps, 0);

  return (
    <Screen title={tr('خطواتك إلى المسجد', 'Steps to the mosque')}>
      {available === false ? (
        <EmptyState icon={Footprints} title={tr('عدّاد الخطوات غير متاح', 'Step counting unavailable')} message={tr('يحتاج هذا إلى جوال فيه عدّاد خطوات، ويعمل في تطبيق الجوال لا في المتصفح.', 'This needs a phone with a step counter, in the mobile app rather than the browser.')} />
      ) : (
        <Card tone="primary" style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
          <Footprints size={34} color={t.colors.highlight} />
          {active ? (
            <>
              <Txt variant="display" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
                {live}
              </Txt>
              <Txt color="rgba(255,255,255,0.9)">
                {tr(`خطوة${active.prayer ? ` إلى صلاة ${f.prayer(active.prayer, info?.day.isFriday && active.prayer === 'dhuhr')}` : ''}`, `steps${active.prayer ? ` to ${f.prayer(active.prayer)}` : ''}`)}
              </Txt>
              <Button title={tr('وصلت المسجد', 'I have arrived')} icon={Landmark} tone="soft" onPress={arrive} />
              <Txt variant="caption" color="rgba(255,255,255,0.75)" onPress={cancel}>
                {tr('إلغاء', 'Cancel')}
              </Txt>
            </>
          ) : result ? (
            <>
              <Txt variant="display" color="#FFFFFF">
                {result.steps}
              </Txt>
              <Txt color="rgba(255,255,255,0.92)" center style={{ lineHeight: 26 }}>
                {tr(`خطوة، كل خطوة منها ترفع درجة وتحطّ خطيئة بإذن الله.${result.prayer ? ` وسجّلنا صلاة ${f.prayer(result.prayer)} جماعةً في «صلاتي».` : ''}`, `steps, each raising a degree and erasing a sin, by Allah's leave.${result.prayer ? ` ${f.prayer(result.prayer)} is logged as prayed in congregation.` : ''}`)}
              </Txt>
              {result.prayer ? (
                <Txt variant="caption" color={t.colors.highlight} onPress={() => (mark(today, result.prayer!, null), setResult({ ...result, prayer: null }))}>
                  {tr('تراجع عن التسجيل', 'Undo logging')}
                </Txt>
              ) : null}
            </>
          ) : (
            <>
              <Txt variant="subheading" color="#FFFFFF" center>
                {prayer ? tr(`ذاهب إلى صلاة ${f.prayer(prayer, info?.day.isFriday && prayer === 'dhuhr')}؟`, `Heading to ${f.prayer(prayer)}?`) : tr('ذاهب إلى المسجد؟', 'Going to the mosque?')}
              </Txt>
              <Button title={tr('انطلق، وعُدّ خطواتي', 'Go, and count my steps')} icon={Footprints} tone="soft" onPress={begin} disabled={available !== true} />
            </>
          )}
        </Card>
      )}

      <Row icon={MapPin} title={tr('دعاء الذهاب إلى المسجد', 'Dua on the way to the mosque')} subtitle={tr('من حصن المسلم', 'From Hisn al-Muslim')} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${GOING_CHAPTER}` } })} />
      <Evidence id={STEPS_HADITH} />
      <Evidence id={FOOTPRINTS_HADITH} />

      {walks.length ? (
        <Card style={{ gap: 8 }}>
          <Txt weight="semibold">{tr('سجل خطواتك', 'Your walks')}</Txt>
          <Txt muted>{tr(`${walks.length} مشوار، ${total.toLocaleString('en')} خطوة إلى بيوت الله${week.length ? `، منها ${week.length} هذا الأسبوع` : ''}.`, `${walks.length} walks, ${total.toLocaleString('en')} steps to the mosque.`)}</Txt>
          {walks.slice(0, 6).map((w) => (
            <View key={w.startedAt} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="caption">{`${w.date}${w.prayer ? ` · ${f.prayer(w.prayer)}` : ''}`}</Txt>
              <Txt variant="caption" muted>
                {tr(`${w.steps} خطوة · ${w.minutes} د`, `${w.steps} steps · ${w.minutes} min`)}
              </Txt>
            </View>
          ))}
        </Card>
      ) : null}
      {active ? (
        <Button title={tr('إلغاء المشوار', 'Cancel walk')} icon={X} tone="plain" onPress={cancel} />
      ) : null}
      <Txt variant="caption" muted center>
        {tr('عدد الخطوات يبقى على جهازك فقط.', 'Step counts stay on your device.')}
      </Txt>
    </Screen>
  );
}
