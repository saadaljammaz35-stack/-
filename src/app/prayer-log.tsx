import { Flame, Minus, Plus, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, IconButton, Txt } from '@/components/ui';
import { MARK_META, markColor, markInk } from '@/features/prayer-log/marks';
import { MarkOptions, notYet } from '@/features/prayer-log/prayer-marker';
import { useNow, usePrayerInfo, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { arabicDays } from '@/lib/arabic';
import { addCivilDays, civilKey, civilWeekday, type CivilDate } from '@/lib/hijri';
import { countMarks, FARD_IDS, isCompleteDay, lastWeek, NAFILA_IDS, PRAYER_MARKS, streak, type NafilaId } from '@/lib/prayer-log';
import { usePrayerLogStore } from '@/store/user';
import { useTheme } from '@/theme';

const NAFILA: Record<NafilaId, { ar: string; en: string }> = {
  duha: { ar: 'الضحى', en: 'Duha' },
  witr: { ar: 'الوتر', en: 'Witr' },
  qiyam: { ar: 'قيام الليل', en: 'Night prayer' },
};

export default function PrayerLogScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const now = useNow(60_000);
  const today = useToday(now);
  const info = usePrayerInfo(now);
  const days = usePrayerLogStore((s) => s.days);
  const qada = usePrayerLogStore((s) => s.qada);
  const toggleNafila = usePrayerLogStore((s) => s.toggleNafila);
  const adjustQada = usePrayerLogStore((s) => s.adjustQada);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const log = { days, qada };
  const week = lastWeek(log, today);
  const selected: CivilDate = week.find((d) => civilKey(d.date) === selectedKey)?.date ?? today;
  const selectedDay = days[civilKey(selected)] ?? {};
  const run = streak(log, today);
  const month = countMarks(log, addCivilDays(today, -29), 30);
  const logged = month.jamaah + month.ontime + month.late + month.missed;
  const owed = FARD_IDS.reduce((n, id) => n + qada[id], 0);

  return (
    <Screen title={tr('صلاتي', 'My prayers')} subtitle={tr('سجلّ خاص بك على جهازك', 'A private log, kept on your device')}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {week.map(({ date, day }) => {
          const key = civilKey(date);
          const on = key === civilKey(selected);
          const complete = isCompleteDay(day);
          return (
            <Pressable
              key={key}
              onPress={() => setSelectedKey(key)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: t.radius.md, backgroundColor: on ? t.colors.fill : t.colors.surface, borderWidth: on ? 0 : 1, borderColor: t.colors.border, gap: 2 }}>
              <Txt variant="label" color={on ? '#FFFFFF' : t.colors.textMuted}>
                {f.weekdayShort(civilWeekday(date))}
              </Txt>
              <Txt weight="bold" color={on ? '#FFFFFF' : t.colors.text}>
                {date.day}
              </Txt>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: complete ? (on ? '#FFFFFF' : t.colors.success) : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>

      <Card style={{ gap: 14 }}>
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {civilKey(selected) === civilKey(today) ? tr('اليوم', 'Today') : f.weekday(selected)} · {f.civil(selected)}
        </Txt>
        {FARD_IDS.map((id) => {
          const locked = notYet(info?.day, selected, id, now);
          return (
            <View key={id} style={{ gap: 8, opacity: locked ? 0.45 : 1 }} pointerEvents={locked ? 'none' : 'auto'}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt weight="medium">{f.prayer(id, info?.day.isFriday && civilKey(selected) === civilKey(today))}</Txt>
                {locked ? (
                  <Txt variant="caption" muted>
                    {tr('لم يحن وقتها', 'Not yet time')}
                  </Txt>
                ) : null}
              </View>
              <MarkOptions date={selected} id={id} />
            </View>
          );
        })}
        <View style={{ gap: 8 }}>
          <Txt variant="caption" muted>
            {tr('النوافل', 'Voluntary')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {NAFILA_IDS.map((id) => (
              <Chip key={id} label={tr(NAFILA[id].ar, NAFILA[id].en)} active={Boolean(selectedDay.nafila?.[id])} onPress={() => toggleNafila(selected, id)} />
            ))}
          </View>
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Flame size={22} color={run ? t.colors.warning : t.colors.textFaint} />
          <Txt weight="semibold" style={{ flex: 1 }}>
            {run ? tr(`سلسلة الصلوات الخمس: ${arabicDays(run)}`, `${run}-day streak of all five prayers`) : tr('سجّل صلواتك لتبدأ سلسلتك', 'Log your prayers to start a streak')}
          </Txt>
        </View>
        {/* The week at a glance: one column per day, one square per prayer. */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {week.map(({ date, day }) => (
            <View key={civilKey(date)} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              {FARD_IDS.map((id) => {
                const m = day[id];
                return <View key={id} style={{ width: '100%', aspectRatio: 1.6, borderRadius: 6, backgroundColor: m ? markColor(m, t.colors) : t.colors.surfaceAlt }} />;
              })}
              <Txt variant="label" muted>
                {f.weekdayShort(civilWeekday(date))}
              </Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {PRAYER_MARKS.map((m) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: markColor(m, t.colors) }} />
              <Txt variant="caption" muted>
                {tr(MARK_META[m].ar, MARK_META[m].en)}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      {logged ? (
        <Card style={{ gap: 10 }}>
          <Txt weight="semibold">{tr('آخر 30 يومًا', 'Last 30 days')}</Txt>
          <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.colors.surfaceAlt }}>
            {PRAYER_MARKS.map((m) => (month[m] ? <View key={m} style={{ flex: month[m], backgroundColor: markColor(m, t.colors) }} /> : null))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRAYER_MARKS.map((m) => (
              <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: markColor(m, t.colors), alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    const Icon = MARK_META[m].icon;
                    return <Icon size={11} color={markInk(m, t.colors)} />;
                  })()}
                </View>
                <Txt variant="caption">
                  {tr(MARK_META[m].ar, MARK_META[m].en)} {Math.round((month[m] / logged) * 100)}%
                </Txt>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('صلوات القضاء', 'Prayers to make up')}</Txt>
            <Txt variant="caption" muted>
              {owed
                ? tr(`عليك ${owed} صلاة — تزيد تلقائيًا عند تسجيل صلاة فائتة`, `${owed} owed — a missed prayer adds one automatically`)
                : tr('لا شيء عليك مسجّل. أضف ما فاتك سابقًا لتتابع قضاءه.', 'Nothing owed. Add earlier missed prayers to track making them up.')}
            </Txt>
          </View>
        </View>
        {FARD_IDS.map((id) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt style={{ flex: 1 }}>{f.prayer(id)}</Txt>
            <IconButton icon={Minus} label={tr('قضيت صلاة', 'Made one up')} size={36} disabled={!qada[id]} onPress={() => adjustQada(id, -1)} />
            <Txt variant="subheading" weight="bold" style={{ minWidth: 36, textAlign: 'center' }}>
              {qada[id]}
            </Txt>
            <IconButton icon={Plus} label={tr('أضف صلاة فائتة', 'Add a missed prayer')} size={36} onPress={() => adjustQada(id, 1)} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
