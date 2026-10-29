// «بين الأذان والإقامة»: opened from the adhan notification. The iqama countdown, the dua after
// the adhan, the user's own duas at a time when duas are answered, and memorised verses to
// recite in this prayer (graded afterwards, so reciting in prayer counts as a review).
import { router } from 'expo-router';
import { BookOpen, Check, HandHeart, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { Screen } from '@/components/screen';
import { Badge, Button, Card, Chip, Tap, Txt } from '@/components/ui';
import { getSurahs, getVerse, type Surah } from '@/data/content';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, usePrayerInfo, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { betweenState, JAHRI, prayerPortions } from '@/lib/between';
import { dueVerses, type HifzGrade } from '@/lib/hifz';
import type { FardId } from '@/lib/prayer-log';
import { useSettings } from '@/store/settings';
import { useDuaStore, useHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

const ADHAN_DUA = 10635;
const BETWEEN_HADITH = 5479;
const IQAMA_CHOICES = [5, 10, 15, 20, 25, 30];

type Portion = { from: number; to: number; label: string };

/** «الملك ١–٥» for each portion. */
function usePortionLabels(portions: [number, number][]): Portion[] {
  const [labels, setLabels] = useState<Portion[]>([]);
  const key = portions.map((p) => p.join('-')).join(',');
  useEffect(() => {
    let alive = true;
    (async () => {
      const surahs: Surah[] = await getSurahs();
      const out: Portion[] = [];
      for (const [from, to] of portions) {
        const [a, b] = await Promise.all([getVerse(from), getVerse(to)]);
        if (!a || !b) continue;
        const name = surahs[a.surah - 1]?.name ?? '';
        out.push({ from, to, label: a.surah === b.surah ? `${name} ${a.ayah}–${b.ayah}` : `${name} ${a.ayah} – ${surahs[b.surah - 1]?.name ?? ''} ${b.ayah}` });
      }
      if (alive) setLabels(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return labels;
}

export default function BetweenScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const iqama = useSettings((s) => s.iqama);
  const location = useSettings((s) => s.location);
  const [wake, setWake] = useState<number | undefined>(undefined);
  const now = useNow(60_000, wake);
  const today = useToday(now);
  const info = usePrayerInfo(now);
  const state = info ? betweenState(now, info.next.previous ? { id: info.next.previous.id as FardId, at: info.next.previous.at } : null, { id: info.next.id as FardId, at: info.next.at }, iqama) : null;
  const nextChange = state ? (state.phase === 'between' ? state.iqamaAt : state.adhanAt).getTime() : undefined;
  if (nextChange !== wake) setWake(nextChange);

  const duas = useDuaStore((s) => s.duas);
  const toggleAnswered = useDuaStore((s) => s.toggleAnswered);
  const pending = duas.filter((d) => !d.answeredAt);

  const cards = useHifzStore((s) => s.cards);
  const grade = useHifzStore((s) => s.grade);
  const prayer = state?.prayer ?? 'fajr';
  const portions = JAHRI.includes(prayer) ? prayerPortions(dueVerses(cards, today), prayer) : [];
  const labels = usePortionLabels(portions);
  const hasHifz = Object.keys(cards).length > 0;

  const gradePortion = (p: Portion, g: HifzGrade) => {
    for (let id = p.from; id <= p.to; id++) grade(id, g, today);
  };

  if (!state || !location || !info) {
    return (
      <Screen title={tr('بين الأذان والإقامة', 'Between adhan and iqama')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const label = f.prayer(state.prayer, info.day.isFriday && state.prayer === 'dhuhr');

  return (
    <Screen title={tr('بين الأذان والإقامة', 'Between adhan and iqama')}>
      <Card tone="primary" style={{ gap: 6, alignItems: 'center', paddingVertical: 20 }}>
        <Txt color="rgba(255,255,255,0.85)">
          {state.phase === 'between' ? tr(`أذان ${label} ${f.time(state.adhanAt, location.timezone)}`, `${label} adhan at ${f.time(state.adhanAt, location.timezone)}`) : tr(`الأذان القادم: ${label} ${f.time(state.adhanAt, location.timezone)}`, `Next adhan: ${label} at ${f.time(state.adhanAt, location.timezone)}`)}
        </Txt>
        <Txt color="#FFFFFF" variant="subheading">
          {state.phase === 'between' ? tr('الإقامة بعد', 'Iqama in') : tr('الأذان بعد', 'Adhan in')}
        </Txt>
        <Countdown target={(state.phase === 'between' ? state.iqamaAt : state.adhanAt).getTime()} digits={useSettings.getState().digits} variant="display" color={t.colors.highlight} style={{ fontVariant: ['tabular-nums'] }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 }}>
          {IQAMA_CHOICES.map((m) => {
            const active = iqama[state.prayer] === m;
            return (
              <Tap
                key={m}
                onPress={() => useSettings.getState().set({ iqama: { ...iqama, [state.prayer]: m } })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? t.colors.highlight : 'rgba(255,255,255,0.14)' }}
              >
                <Txt weight="semibold" color={active ? t.colors.primaryDeep : '#FFFFFF'}>
                  {tr(`${m} د`, `${m} min`)}
                </Txt>
              </Tap>
            );
          })}
        </View>
        <Txt variant="caption" color="rgba(255,255,255,0.75)">
          {tr(`المدة بين الأذان والإقامة لصلاة ${label} في مسجدك`, `Minutes from adhan to iqama for ${label} at your mosque`)}
        </Txt>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="bold" color={t.colors.primaryDeep}>
          {tr('إذا سمعت الأذان', 'When you hear the adhan')}
        </Txt>
        <Evidence id={ADHAN_DUA} full />
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HandHeart size={20} color={t.colors.primary} />
          <Txt weight="bold" color={t.colors.primaryDeep} style={{ flex: 1 }}>
            {tr('ادعُ الآن', 'Make dua now')}
          </Txt>
        </View>
        <Evidence id={BETWEEN_HADITH} />
        {pending.map((d) => (
          <Tap key={d.id} onPress={() => toggleAnswered(d.id)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: t.colors.primary, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Txt style={{ lineHeight: 24 }}>{d.text}</Txt>
              {d.for ? (
                <Txt variant="caption" muted>
                  {d.for}
                </Txt>
              ) : null}
            </View>
          </Tap>
        ))}
        <Button title={pending.length ? tr('دفتر دعائي', 'My duas') : tr('اكتب ما تريد أن تدعو به', 'Write what you want to ask for')} icon={pending.length ? HandHeart : Plus} tone="soft" onPress={() => router.push('/duas/mine')} />
      </Card>

      {JAHRI.includes(state.prayer) ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BookOpen size={20} color={t.colors.primary} />
            <Txt weight="bold" color={t.colors.primaryDeep} style={{ flex: 1 }}>
              {tr('راجع حفظك في صلاتك', 'Review your memorisation in prayer')}
            </Txt>
          </View>
          {!hasHifz ? (
            <>
              <Txt muted>{tr('ابدأ الحفظ، وسنقترح عليك هنا ما تقرؤه في صلاتك لتثبّته.', 'Start memorising and this will suggest what to recite in your prayer to keep it.')}</Txt>
              <Button title={tr('ابدأ الحفظ', 'Start memorising')} tone="soft" onPress={() => router.push('/hifz')} />
            </>
          ) : labels.length ? (
            <>
              <Txt muted>{tr('آيات حان وقت مراجعتها، اقرأها في الركعتين ثم قيّم تسميعك:', 'Verses due for review — recite them in the two rak‘ahs, then rate how it went:')}</Txt>
              {labels.map((p, i) => (
                <View key={p.from} style={{ gap: 8, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Badge label={tr(`الركعة ${i + 1}`, `Rak‘ah ${i + 1}`)} tone="sahih" />
                    <Tap onPress={() => router.push(`/mushaf?verse=${p.from}`)} style={{ flex: 1 }}>
                      <Txt weight="semibold">{p.label}</Txt>
                    </Tap>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Chip label={tr('أتقنتها', 'Fluent')} onPress={() => gradePortion(p, 'good')} />
                    <Chip label={tr('تعثّرت', 'Hesitant')} onPress={() => gradePortion(p, 'hard')} />
                    <Chip label={tr('نسيت', 'Forgot')} onPress={() => gradePortion(p, 'again')} />
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check size={18} color={t.colors.primary} />
              <Txt muted style={{ flex: 1 }}>
                {tr('لا مراجعة مستحقة اليوم. اقرأ مما تحفظ.', 'Nothing is due today. Recite whatever you know.')}
              </Txt>
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
