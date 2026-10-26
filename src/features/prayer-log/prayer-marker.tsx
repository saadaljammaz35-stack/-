// Marking the five prayers: option rows for the log screen and a compact strip for Home.
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, type CivilDate } from '@/lib/hijri';
import { FARD_IDS, PRAYER_MARKS, type FardId } from '@/lib/prayer-log';
import type { DayTimes } from '@/lib/prayer-times';
import { usePrayerLogStore } from '@/store/user';
import { useTheme } from '@/theme';

import { MARK_META, markColor, markInk } from './marks';

/** Today's prayers that have not started yet cannot be logged. */
export function notYet(day: DayTimes | null | undefined, date: CivilDate, id: FardId, now: Date): boolean {
  return Boolean(day && civilKey(day.date) === civilKey(date) && day.times[id].getTime() > now.getTime());
}

export function MarkOptions({ date, id, onDone }: { date: CivilDate; id: FardId; onDone?: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const current = usePrayerLogStore((s) => s.days[civilKey(date)]?.[id]);
  const mark = usePrayerLogStore((s) => s.mark);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {PRAYER_MARKS.map((m) => {
        const on = current === m;
        const meta = MARK_META[m];
        const color = markColor(m, t.colors);
        return (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => {
              mark(date, id, on ? null : m);
              onDone?.();
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 2,
              paddingVertical: 8,
              borderRadius: t.radius.md,
              backgroundColor: on ? color : t.colors.surfaceAlt,
              opacity: pressed ? 0.8 : 1,
            })}>
            <meta.icon size={16} color={on ? markInk(m, t.colors) : color} />
            <Txt variant="label" weight={on ? 'semibold' : 'regular'} color={on ? markInk(m, t.colors) : t.colors.textMuted}>
              {tr(meta.ar, meta.en)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Today's five prayers as dots; tap one to log it. */
export function PrayerStrip({ date, day, now }: { date: CivilDate; day: DayTimes | null; now: Date }) {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const log = usePrayerLogStore((s) => s.days[civilKey(date)]);
  const [open, setOpen] = useState<FardId | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {FARD_IDS.map((id) => {
          const m = log?.[id];
          const locked = notYet(day, date, id, now);
          const color = m ? markColor(m, t.colors) : t.colors.surfaceAlt;
          const Icon = m ? MARK_META[m].icon : null;
          return (
            <Pressable
              key={id}
              disabled={locked}
              onPress={() => setOpen((o) => (o === id ? null : id))}
              accessibilityLabel={`${f.prayer(id, day?.isFriday)}${m ? ` — ${tr(MARK_META[m].ar, MARK_META[m].en)}` : ''}`}
              style={{ alignItems: 'center', gap: 6, opacity: locked ? 0.4 : 1 }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: open === id ? 2 : 0,
                  borderColor: t.colors.primary,
                }}>
                {Icon && m ? <Icon size={20} color={markInk(m, t.colors)} /> : null}
              </View>
              <Txt variant="label" muted={!m} weight={m ? 'semibold' : 'regular'}>
                {f.prayer(id, day?.isFriday)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {open ? <MarkOptions date={date} id={open} onDone={() => setOpen(null)} /> : null}
    </View>
  );
}
