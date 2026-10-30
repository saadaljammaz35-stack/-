import { router } from 'expo-router';
import { Baby, BookMarked, Brain, Ear, Hourglass, Palette, Play, Plus, RotateCcw } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, Group, IconCircle, ProgressBar, Row, Segmented, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { surahOfVerse, surahStarts } from '@/features/hifz/verse-words';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { hifzStats } from '@/lib/hifz';
import { useSettings } from '@/store/settings';
import { useHifzStore, type HifzHide } from '@/store/user';
import { useTheme } from '@/theme';

const REPEATS = [1, 3, 5, 7, 10];

export default function HifzHome() {
  const t = useTheme();
  const { tr } = useI18n();
  const today = useToday();
  const cards = useHifzStore((s) => s.cards);
  const plan = useHifzStore((s) => s.plan);
  const repeat = useHifzStore((s) => s.repeat);
  const hide = useHifzStore((s) => s.hide);
  const setPrefs = useHifzStore((s) => s.set);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [starts, setStarts] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([getSurahs(), surahStarts()]).then(([s, st]) => {
      setSurahs(s);
      setStarts(st);
    });
  }, []);

  const stats = hifzStats(cards, today);
  const perSurah = useMemo(() => {
    if (!starts.length) return [];
    const map = new Map<number, { memorised: number; total: number }>();
    for (const [id, c] of Object.entries(cards)) {
      const s = surahOfVerse(starts, Number(id));
      const e = map.get(s) ?? { memorised: 0, total: 0 };
      e.total++;
      if (c.box >= 1) e.memorised++;
      map.set(s, e);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [cards, starts]);

  const planSurah = plan ? surahs[plan.surah - 1] : null;

  return (
    <Screen title={tr('الحفظ', 'Memorise')} subtitle={tr('احفظ آية آية، وراجع في الوقت المناسب', 'Learn verse by verse, review at the right time')}>
      <Card tone="primary" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconCircle icon={RotateCcw} size={46} tint="rgba(255,255,255,0.16)" color={t.colors.onPrimary} />
          <View style={{ flex: 1 }}>
            <Txt variant="subheading" weight="bold" color={t.colors.onPrimary}>
              {tr('مراجعة اليوم', 'Today’s review')}
            </Txt>
            <Txt variant="caption" color={t.colors.onPrimary} style={{ opacity: 0.85 }}>
              {stats.due
                ? tr(`${stats.due} آية حان موعد مراجعتها`, `${stats.due} verses are due`)
                : stats.total
                  ? tr('لا مراجعة مستحقة اليوم، أحسنت', 'Nothing due today — well done')
                  : tr('ستظهر هنا الآيات التي تحفظها عند موعد مراجعتها', 'Verses you learn come back here when they are due')}
            </Txt>
          </View>
        </View>
        {stats.due ? <Button title={tr('ابدأ المراجعة', 'Start review')} icon={Play} tone="soft" onPress={() => router.push({ pathname: '/hifz/session', params: { mode: 'review' } })} /> : null}
      </Card>

      {plan && planSurah ? (
        <Card onPress={() => router.push({ pathname: '/hifz/session', params: { mode: 'learn', surah: String(plan.surah), from: String(plan.next), to: String(plan.to) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconCircle icon={BookMarked} size={46} tint={t.colors.tints[2]} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('متابعة الحفظ', 'Continue learning')}</Txt>
            <Txt variant="caption" muted>
              {tr(`سورة ${planSurah.name} — من الآية ${plan.next} إلى ${plan.to}`, `${planSurah.nameSimple} — verses ${plan.next}–${plan.to}`)}
            </Txt>
          </View>
          <Play size={20} color={t.colors.primary} />
        </Card>
      ) : null}

      <Button title={tr('حفظ مقطع جديد', 'Learn a new passage')} icon={Plus} onPress={() => router.push('/hifz/new')} />
      <Group>
        <Row icon={Ear} title={tr('المراجعة السماعية', 'Listening review')} subtitle={tr('استمع وردّد، أو سمّع ثم تحقّق — والشاشة مطفأة', 'Listen and repeat, or recite then check — screen off')} onPress={() => router.push(plan ? { pathname: '/hifz/listen', params: { surah: String(plan.surah), from: String(plan.from), to: String(plan.to) } } : '/hifz/listen')} />
      </Group>

      {stats.total ? (
        <Group>
          <Row
            icon={Palette}
            title={tr('مصحف الحفظ الملوّن', 'Colour-coded mushaf')}
            subtitle={tr('كل آية تحفظها بلون قوة حفظها', 'Each verse you know, coloured by how firmly')}
            onPress={() => {
              useSettings.getState().set({ hifzColors: true });
              router.push('/mushaf');
            }}
          />
          <Row icon={Hourglass} title={tr('راجع في صلاتك', 'Review in your prayer')} subtitle={tr('بعد الأذان نقترح ما تقرؤه في الركعتين', 'After the adhan, what to recite in the two rak‘ahs')} onPress={() => router.push('/between')} />
        </Group>
      ) : null}

      <Card onPress={() => router.push('/kids')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Baby size={24} color={t.colors.primary} />
        <View style={{ flex: 1 }}>
          <Txt weight="semibold">{tr('حفظ الصغار', 'Kids’ hifz')}</Txt>
          <Txt variant="caption" muted>
            {tr('قصار السور لأطفالك، آية آية، بنجمة لكل آية', 'The short surahs for your children, a star for each verse')}
          </Txt>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('طريقة الحفظ', 'How you learn')}</Txt>
        <Txt variant="caption" muted>
          {tr('عدد مرات الاستماع لكل آية قبل اختبارها', 'Times each verse is played before it is hidden')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REPEATS.map((n) => (
            <Chip key={n} label={tr(`${n} مرات`, `${n}×`)} active={repeat === n} onPress={() => setPrefs({ repeat: n })} />
          ))}
        </View>
        <Txt variant="caption" muted>
          {tr('عند الاختبار', 'When testing')}
        </Txt>
        <Segmented<HifzHide>
          value={hide}
          onChange={(v) => setPrefs({ hide: v })}
          options={[
            { value: 'first', label: tr('أظهر أول حرف', 'First letters') },
            { value: 'blank', label: tr('إخفاء كامل', 'Hide all') },
          ]}
        />
      </Card>

      {stats.total ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat value={stats.memorised} label={tr('آية محفوظة', 'memorised')} />
            <Stat value={stats.strong} label={tr('راسخة', 'strong')} />
            <Stat value={Math.round((stats.memorised / 6236) * 1000) / 10} label={tr('٪ من القرآن', '% of the Quran')} />
          </View>
          {perSurah.map(([id, e]) => {
            const s = surahs[id - 1];
            if (!s) return null;
            return (
              <View key={id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt weight="medium">{tr(`سورة ${s.name}`, s.nameSimple)}</Txt>
                  <Txt variant="caption" muted>
                    {tr(`${e.memorised} من ${s.versesCount}`, `${e.memorised} / ${s.versesCount}`)}
                  </Txt>
                </View>
                <ProgressBar value={e.memorised / s.versesCount} />
              </View>
            );
          })}
        </Card>
      ) : (
        <EmptyState
          icon={Brain}
          title={tr('كيف يعمل الحفظ؟', 'How it works')}
          message={tr(
            'اختر سورة ومقطعًا. تسمع كل آية بصوت قارئك مع تظليل الكلمات، ثم تُخفى لتسمّعها من حفظك. قيّم نفسك، ويعيد التطبيق الآية عليك بعد يوم ثم ثلاثة ثم أسبوع ثم أسبوعين وهكذا حتى ترسخ.',
            'Pick a surah and a passage. Hear each verse from your reciter with the words lit up, then it is hidden and you recite it from memory. Grade yourself, and the verse comes back after a day, then three, a week, two weeks and so on until it sticks.',
          )}
        />
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: t.colors.primarySoft, borderRadius: t.radius.md, paddingVertical: 10 }}>
      <Txt variant="title" weight="bold" color={t.colors.primaryDeep}>
        {value}
      </Txt>
      <Txt variant="caption" muted>
        {label}
      </Txt>
    </View>
  );
}
