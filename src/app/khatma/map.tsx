// «خريطة ختمتك»: all 604 pages on one screen, juz by juz: what is read, what was missed, and
// today's portion. Without a khatma, it shows every page read in the past year.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { Card, Segmented, Txt } from '@/components/ui';
import { getJuzStartPages } from '@/data/content';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { status, TOTAL_PAGES } from '@/lib/khatma';
import { useKhatmaStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

type Cell = 'read' | 'missed' | 'today' | 'none';
const LABEL = 26;
const GAP = 2;
const MAX_PER_JUZ = 24;

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}

export default function KhatmaMap() {
  const t = useTheme();
  const { tr } = useI18n();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const today = useToday();
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const pagesRead = useQuranStore((s) => s.pagesRead);
  const [juzStarts, setJuzStarts] = useState<number[]>([]);
  const k = khatmas.find((x) => x.id === params.id) ?? khatmas.find((x) => x.status === 'active') ?? null;
  const [mode, setMode] = useState<'khatma' | 'all'>(k ? 'khatma' : 'all');
  useEffect(() => {
    getJuzStartPages().then(setJuzStarts);
  }, []);

  const cells: Cell[] = new Array(TOTAL_PAGES + 1).fill('none');
  let read = 0;
  let missed = 0;
  let todayLeft = 0;
  if (mode === 'khatma' && k) {
    const s = status(k, today);
    const missedTo = s.delta < 0 ? k.progress - s.delta : k.progress;
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      if (p <= k.progress) cells[p] = 'read';
      else if (p <= missedTo) cells[p] = 'missed';
      else if (k.status === 'active' && s.today && p >= s.today.from && p <= s.today.to) cells[p] = 'today';
    }
    read = k.progress;
    missed = missedTo - k.progress;
    todayLeft = cells.filter((c) => c === 'today').length;
  } else {
    for (const pages of Object.values(pagesRead)) for (const p of pages) cells[p] = 'read';
    read = cells.filter((c) => c === 'read').length;
  }

  const colors: Record<Cell, string> = { read: t.colors.primary, missed: t.colors.danger, today: t.colors.highlight, none: t.colors.surfaceAlt };
  const innerWidth = width - 32 - 28;
  const cell = Math.max(8, Math.floor((innerWidth - LABEL) / MAX_PER_JUZ) - GAP);
  const rowH = cell + GAP * 2;
  const svgW = LABEL + MAX_PER_JUZ * (cell + GAP);
  const rows = juzStarts.map((from, j) => ({ juz: j + 1, from, to: (juzStarts[j + 1] ?? TOTAL_PAGES + 1) - 1 }));

  /** Pages run right to left, as in the mushaf. */
  const cellX = (i: number) => svgW - LABEL - (i + 1) * (cell + GAP);
  const onPress = (x: number, y: number) => {
    const row = rows[Math.floor(y / rowH)];
    if (!row) return;
    const i = Math.floor((svgW - LABEL - x) / (cell + GAP));
    const page = row.from + i;
    if (i >= 0 && page <= row.to) router.push({ pathname: '/mushaf', params: { page: String(page) } });
  };

  return (
    <Screen title={tr('خريطة الختمة', 'Khatma map')} subtitle={tr('اضغط أي صفحة لفتحها', 'Tap a page to open it')}>
      {k ? (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'khatma', label: k.name },
            { value: 'all', label: tr('كل قراءتي', 'All my reading') },
          ]}
        />
      ) : null}
      <Card style={{ gap: 8 }}>
        <Txt weight="semibold">
          {mode === 'khatma' && k
            ? tr(`قرأت ${read} من ${TOTAL_PAGES} صفحة`, `${read} of ${TOTAL_PAGES} pages read`)
            : tr(`قرأت ${read} صفحة مختلفة من المصحف خلال آخر سنة`, `${read} different pages read in the past year`)}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Legend color={colors.read} label={tr('مقروءة', 'Read')} />
          {mode === 'khatma' && k ? (
            <>
              <Legend color={colors.missed} label={tr(`فاتتك (${missed})`, `Missed (${missed})`)} />
              <Legend color={colors.today} label={tr(`ورد اليوم (${todayLeft})`, `Today (${todayLeft})`)} />
            </>
          ) : null}
          <Legend color={colors.none} label={tr('لم تُقرأ', 'Not yet')} />
        </View>
      </Card>
      <Card style={{ paddingHorizontal: 14, alignItems: 'center' }}>
        <Pressable onPress={(e) => onPress(e.nativeEvent.locationX, e.nativeEvent.locationY)} accessibilityLabel={tr('خريطة صفحات المصحف', 'Map of the mushaf pages')}>
          <Svg width={svgW} height={rows.length * rowH}>
            {rows.map((row, r) => (
              <SvgText key={`l${row.juz}`} x={svgW - LABEL / 2} y={r * rowH + GAP + cell - 1} fontSize={Math.min(11, cell)} fill={t.colors.textMuted} textAnchor="middle">
                {row.juz}
              </SvgText>
            ))}
            {rows.flatMap((row, r) =>
              Array.from({ length: row.to - row.from + 1 }, (_, i) => (
                <Rect key={row.from + i} x={cellX(i)} y={r * rowH + GAP} width={cell} height={cell} rx={2} fill={colors[cells[row.from + i]]} />
              )),
            )}
          </Svg>
        </Pressable>
      </Card>
      <Txt variant="caption" muted center>
        {tr('كل سطر جزء، والصفحات من اليمين إلى اليسار كما في المصحف.', 'Each row is a juz; pages run right to left as in the mushaf.')}
      </Txt>
    </Screen>
  );
}
