// «يومي» on Home: a segmented ring that fills as the day's essentials are done, with a row
// for each one that opens it (the prayers row expands into the quick log).
import { router } from 'expo-router';
import { BookOpen, Brain, Check, Moon, Sunrise, UsersRound, Wheat, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Card, ForwardChevron, Txt } from '@/components/ui';
import { useAdhkarList } from '@/features/adhkar/lists';
import { PrayerStrip } from '@/features/prayer-log/prayer-marker';
import { useI18n } from '@/i18n';
import { arabicDays } from '@/lib/arabic';
import { dailyItems, dailyProgress, type DailyItem, type DailyItemId } from '@/lib/daily';
import { civilKey, type CivilDate } from '@/lib/hijri';
import { streak } from '@/lib/prayer-log';
import type { DayTimes } from '@/lib/prayer-times';
import { adhkarProgressKey, useAdhkarStore, useHifzStore, useKhatmaStore, usePrayerLogStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

function useListDone(id: string, today: CivilDate): { done: number; total: number } | null {
  const items = useAdhkarList(id);
  const progress = useAdhkarStore((s) => s.progress[civilKey(today)]);
  if (!items) return null;
  return { done: items.filter((i) => (progress?.[adhkarProgressKey(id, i.key)] ?? 0) >= i.repeat).length, total: items.length };
}

const ICONS: Record<DailyItemId, LucideIcon> = { prayers: UsersRound, quran: BookOpen, morning: Sunrise, evening: Moon, hifz: Brain };

function itemColor(id: DailyItemId, primary: string, gold: string): string {
  return id === 'prayers' ? primary : id === 'quran' ? gold : id === 'morning' ? '#E09A3E' : id === 'evening' ? '#6F6BC0' : '#3A9A8C';
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)}`;
}

function Ring({ items, size, percent }: { items: DailyItem[]; size: number; percent: number }) {
  const t = useTheme();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const gap = items.length > 1 ? 14 : 0;
  const span = 360 / items.length;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {items.length === 1 ? <Circle cx={c} cy={c} r={r} stroke={t.colors.surfaceAlt} strokeWidth={stroke} fill="none" /> : null}
        {items.map((it, i) => {
          const from = i * span + gap / 2;
          const to = (i + 1) * span - gap / 2;
          const f = Math.min(1, it.done / it.total);
          return (
            <G key={it.id}>
              {items.length > 1 ? <Path d={arc(c, c, r, from, to)} stroke={t.colors.surfaceAlt} strokeWidth={stroke} strokeLinecap="round" fill="none" /> : null}
              {f > 0 ? (
                <Path d={arc(c, c, r, from, from + Math.max(0.5, (to - from) * f))} stroke={itemColor(it.id, t.colors.primary, t.colors.gold)} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              ) : null}
            </G>
          );
        })}
      </Svg>
      <Txt variant="title" weight="bold" color={t.colors.primaryDeep} style={{ fontVariant: ['tabular-nums'] }}>
        {Math.round(percent * 100)}%
      </Txt>
    </View>
  );
}

export function DailyRing({ today, day, now }: { today: CivilDate; day: DayTimes | null; now: Date }) {
  const t = useTheme();
  const { tr } = useI18n();
  const prayers = usePrayerLogStore((s) => s.days[civilKey(today)]);
  const allPrayers = usePrayerLogStore((s) => s.days);
  const qada = usePrayerLogStore((s) => s.qada);
  const khatma = useKhatmaStore((s) => s.khatmas.find((k) => k.status === 'active'));
  const pagesToday = useQuranStore((s) => s.pagesRead[civilKey(today)]?.length ?? 0);
  const lastPage = useQuranStore((s) => s.lastRead?.page ?? 1);
  const hifz = useHifzStore((s) => s.cards);
  const morning = useListDone('morning', today);
  const evening = useListDone('evening', today);
  const [openPrayers, setOpenPrayers] = useState(false);

  const items = dailyItems({ today, prayers, khatma, pagesToday, morning, evening, hifz });
  const percent = dailyProgress(items);
  const run = streak({ days: allPrayers, qada }, today);

  const label: Record<DailyItemId, string> = {
    prayers: tr('الصلوات الخمس', 'Five prayers'),
    quran: khatma ? tr(`ورد ${khatma.name}`, `${khatma.name} portion`) : tr('ورد القرآن', 'Quran'),
    morning: tr('أذكار الصباح', 'Morning adhkar'),
    evening: tr('أذكار المساء', 'Evening adhkar'),
    hifz: tr('مراجعة الحفظ', 'Memorisation review'),
  };
  const value = (it: DailyItem) =>
    it.id === 'quran' && !khatma ? (it.done >= it.total ? tr('تم', 'Done') : tr('اقرأ ولو صفحة', 'Read a page')) : `${it.done}/${it.total}`;
  const open = (id: DailyItemId) => {
    if (id === 'prayers') setOpenPrayers((o) => !o);
    else if (id === 'quran') router.push({ pathname: '/mushaf', params: { page: String(khatma ? Math.min(604, khatma.progress + 1) : lastPage) } });
    else if (id === 'morning' || id === 'evening') router.push(`/adhkar/${id}`);
    else router.push({ pathname: '/hifz/session', params: { mode: 'review' } });
  };

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Ring items={items} size={104} percent={percent} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="heading" weight="bold" color={t.colors.primaryDeep}>
            {tr('يومي', 'My day')}
          </Txt>
          <Txt variant="caption" muted>
            {percent >= 1
              ? tr('أتممت يومك، تقبّل الله منك', 'Your day is complete — may Allah accept')
              : percent === 0
                ? tr('ابدأ يومك بما تيسّر', 'Start your day with what you can')
                : tr(`أنجزت ${items.filter((i) => i.done >= i.total).length} من ${items.length}`, `${items.filter((i) => i.done >= i.total).length} of ${items.length} done`)}
          </Txt>
          {run ? (
            <Txt variant="caption" color={t.colors.warning}>
              {tr(`سلسلة الصلوات الخمس: ${arabicDays(run)}`, `${run}-day prayer streak`)}
            </Txt>
          ) : null}
          <Pressable
            onPress={() => router.push('/harvest')}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, backgroundColor: t.colors.primarySoft, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, opacity: pressed ? 0.75 : 1 })}>
            <Wheat size={14} color={t.colors.primaryDeep} />
            <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>
              {tr('حصادي', 'My harvest')}
            </Txt>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        {items.map((it) => {
          const Icon = ICONS[it.id];
          const complete = it.done >= it.total;
          const color = itemColor(it.id, t.colors.primary, t.colors.gold);
          return (
            <View key={it.id}>
              <Pressable
                onPress={() => open(it.id)}
                accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: complete ? color : t.colors.surfaceAlt }}>
                  {complete ? <Check size={17} color="#FFFFFF" strokeWidth={2.6} /> : <Icon size={16} color={color} />}
                </View>
                <Txt weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {label[it.id]}
                </Txt>
                <Txt variant="caption" muted={!complete} color={complete ? color : undefined} style={{ fontVariant: ['tabular-nums'] }}>
                  {value(it)}
                </Txt>
                <ForwardChevron size={16} />
              </Pressable>
              {it.id === 'prayers' && openPrayers ? (
                <View style={{ paddingBottom: 8 }}>
                  <PrayerStrip date={today} day={day} now={now} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
