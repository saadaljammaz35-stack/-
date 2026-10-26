// Page-by-page adhkar reader: one dhikr per page, a large counter in a floating bar, and an
// automatic move to the next dhikr once its count is complete.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BookOpen, Check, ChevronDown, Heart, Pause, Play, RotateCcw, Share2 } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { BookPager, type BookPagerHandle } from '@/components/book-pager';
import { StarMark } from '@/components/brand';
import { Badge, Button, IconButton, ProgressBar, QuranText, ReadingText, Txt } from '@/components/ui';
import type { DhikrItem } from '@/data/content';
import { usePlayer } from '@/features/audio/player';
import { openShare } from '@/features/home/daily-cards';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { gradeTone } from '@/lib/hadith-grades';
import { useSettings } from '@/store/settings';
import { useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

type Page = { kind: 'dhikr'; item: DhikrItem } | { kind: 'done' };

const COUNTER = 76;

function repeatWords(n: number, tr: (ar: string, en: string) => string): string {
  if (n === 1) return tr('مرة واحدة', 'Once');
  if (n === 2) return tr('مرتان', 'Twice');
  if (n >= 3 && n <= 10) return tr(`${n} مرات`, `${n} times`);
  return tr(`${n} مرة`, `${n} times`);
}

function CounterRing({ value, total, done }: { value: number; total: number; done: boolean }) {
  const t = useTheme();
  const r = COUNTER / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <Svg width={COUNTER} height={COUNTER} style={StyleSheet.absoluteFill}>
      <Circle cx={COUNTER / 2} cy={COUNTER / 2} r={r} stroke={t.colors.primarySoft} strokeWidth={5} fill="none" />
      <Circle
        cx={COUNTER / 2}
        cy={COUNTER / 2}
        r={r}
        stroke={done ? t.colors.success : t.colors.primary}
        strokeWidth={5}
        fill="none"
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${COUNTER / 2} ${COUNTER / 2})`}
      />
    </Svg>
  );
}

function DhikrPage({ item, width, onCount, showChapter }: { item: DhikrItem; width: number; onCount: () => void; showChapter: boolean }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);

  if (item.kind === 'surah') {
    return (
      <View style={{ width, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <BookOpen size={40} color={t.colors.primaryDeep} strokeWidth={1.5} />
        <Txt variant="title" center color={t.colors.primaryDeep}>
          {item.text}
        </Txt>
        <Txt muted center>
          {item.reference}
        </Txt>
        <Button title={tr('اقرأها في المصحف', 'Read in the mushaf')} icon={BookOpen} onPress={() => router.push({ pathname: '/mushaf', params: { surah: String(item.surahId), ayah: '1' } })} />
      </View>
    );
  }

  return (
    <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 190, gap: 16 }} showsVerticalScrollIndicator={false}>
      {item.by || item.grade ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {item.by ? <Badge label={item.by} /> : null}
          {item.grade ? <Badge label={item.grade} tone={gradeTone(item.grade)} /> : null}
        </View>
      ) : null}
      {showChapter && item.chapterTitle ? (
        <Txt variant="subheading" weight="semibold" color={t.colors.primary}>
          {item.chapterTitle}
        </Txt>
      ) : null}
      {/* Tapping the text counts too, like tapping the counter. */}
      <Pressable onPress={onCount} accessibilityHint={tr('اضغط للعدّ', 'Tap to count')}>
        {item.isQuran ? (
          <QuranText size={t.rs(25)} style={{ textAlign: 'right' }}>
            {item.text}
          </QuranText>
        ) : (
          <ReadingText size={24} selectable={false}>
            {item.text}
          </ReadingText>
        )}
      </Pressable>
      {item.reference ? (
        <Txt variant="caption" color={t.colors.primary}>
          {item.reference}
        </Txt>
      ) : null}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} />
      <Txt center weight="medium" muted>
        {item.repeatLabel ?? repeatWords(item.repeat, tr)}
      </Txt>
      {item.fadl ? (
        <View style={{ backgroundColor: t.colors.primarySoft, borderRadius: 16, padding: 14, gap: 4 }}>
          <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>
            {tr('الفضل', 'Virtue')}
          </Txt>
          <Txt variant="caption" color={t.colors.primaryDeep}>
            {item.fadl}
          </Txt>
        </View>
      ) : null}
      {item.footnotes.length || item.explanation ? (
        <Pressable onPress={() => setOpen((o) => !o)} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt variant="caption" weight="semibold" color={t.colors.primary}>
              {tr('المصدر والتخريج', 'Source & takhrij')}
            </Txt>
            <ChevronDown size={16} color={t.colors.primary} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
          </View>
          {open
            ? item.footnotes.map((f, i) => (
                <Txt key={i} variant="caption" muted>
                  {`(${i + 1}) ${f}`}
                </Txt>
              ))
            : null}
          {open && item.explanation ? <Txt variant="caption">{item.explanation}</Txt> : null}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function DonePage({ width, onReset }: { width: number; onReset: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <View style={{ width, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <StarMark size={84} />
      <Txt variant="title" center color={t.colors.primaryDeep}>
        {tr('تقبّل الله منك', 'May Allah accept from you')}
      </Txt>
      <Txt muted center>
        {tr('أتممت أذكار هذا الباب.', 'You have completed these adhkar.')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Button title={tr('إعادة العدّ', 'Start again')} icon={RotateCcw} tone="soft" onPress={onReset} />
        <Button title={tr('رجوع', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/adhkar'))} />
      </View>
    </View>
  );
}

export function DhikrReader({
  items,
  counts,
  onCount,
  onResetItem,
  onResetAll,
}: {
  items: DhikrItem[];
  counts: Record<string, number>;
  onCount: (item: DhikrItem) => void;
  onResetItem: (item: DhikrItem) => void;
  onResetAll: () => void;
}) {
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const digits = useSettings((s) => s.digits);
  const haptics = useSettings((s) => s.haptics);
  const favorites = useAdhkarStore((s) => s.favorites);
  const toggleFavorite = useAdhkarStore((s) => s.toggleFavorite);
  const player = usePlayer();
  const pagerRef = useRef<BookPagerHandle>(null);

  const pages = useMemo<Page[]>(() => [...items.map((item) => ({ kind: 'dhikr' as const, item })), { kind: 'done' as const }], [items]);
  const firstOpen = Math.max(0, items.findIndex((i) => i.kind !== 'surah' && (counts[i.key] ?? 0) < i.repeat));
  const [index, setIndex] = useState(firstOpen);

  const counted = items.filter((i) => i.kind !== 'surah');
  // Chapter names only help when a list mixes several Hisn al-Muslim chapters.
  const mixedChapters = new Set(items.map((i) => i.chapterTitle).filter(Boolean)).size > 1;
  const doneCount = counted.filter((i) => (counts[i.key] ?? 0) >= i.repeat).length;
  const page = pages[index];
  const item = page?.kind === 'dhikr' ? page.item : null;
  const count = item ? (counts[item.key] ?? 0) : 0;
  const complete = item ? count >= item.repeat : false;
  const fav = item ? favorites.includes(item.key) : false;
  const playing = item?.audio && player.now?.kind === 'clip' && player.now.url === item.audio && player.playing;
  const num = (n: number) => (digits === 'arabic' ? toArabicDigits(n) : String(n));

  const goTo = useCallback(
    (i: number, animated = true) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, i));
      setIndex(clamped);
      pagerRef.current?.goTo(clamped, animated);
    },
    [pages.length],
  );

  const tap = () => {
    if (!item || item.kind === 'surah' || complete) return;
    onCount(item);
    const finished = count + 1 >= item.repeat;
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(finished ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    if (finished) setTimeout(() => goTo(index + 1), 450);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <ProgressBar value={counted.length ? doneCount / counted.length : 0} height={4} />
      </View>
      <BookPager
        ref={pagerRef}
        data={pages}
        initialIndex={index}
        width={width}
        keyOf={(p) => (p.kind === 'dhikr' ? p.item.key : 'done')}
        onIndexChange={setIndex}
        renderPage={(p) =>
          p.kind === 'dhikr' ? (
            <View style={{ width, flex: 1, direction: 'rtl' }}>
              <DhikrPage item={p.item} width={width} showChapter={mixedChapters} onCount={() => p.item.key === item?.key && tap()} />
            </View>
          ) : (
            <View style={{ width, flex: 1, direction: 'rtl' }}>
              <DonePage
                width={width}
                onReset={() => {
                  onResetAll();
                  goTo(0, false);
                }}
              />
            </View>
          )
        }
      />

      {item ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16 }}>
          <Txt variant="caption" muted style={{ alignSelf: 'flex-end', marginBottom: 6, marginHorizontal: 12, writingDirection: 'ltr' }}>
            {`${num(index + 1)} | ${num(items.length)}`}
          </Txt>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: t.colors.tabBar,
              borderRadius: 40,
              paddingHorizontal: 18,
              height: 72,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.colors.border,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}>
            <IconButton icon={Share2} label={tr('مشاركة', 'Share')} tone="plain" onPress={() => openShare({ title: item.chapterTitle ?? tr('ذكر', 'Dhikr'), text: item.text, reference: item.reference, quran: item.isQuran })} />
            {item.audio ? (
              <IconButton icon={playing ? Pause : Play} label={tr('استماع', 'Listen')} tone="plain" onPress={() => (playing ? player.toggle() : player.playClip(item.audio!, item.chapterTitle ?? tr('ذكر', 'Dhikr')))} />
            ) : (
              <View style={{ width: 44 }} />
            )}
            {item.kind === 'surah' ? (
              <View style={{ width: COUNTER }} />
            ) : (
              <Pressable
                onPress={tap}
                accessibilityRole="button"
                accessibilityLabel={tr('العدّاد', 'Counter')}
                style={({ pressed }) => ({ width: COUNTER, height: COUNTER, marginTop: -26, borderRadius: COUNTER / 2, backgroundColor: complete ? t.colors.fill : t.colors.surface, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 })}>
                <CounterRing value={count} total={item.repeat} done={complete} />
                {complete ? (
                  <Check size={30} color="#FFFFFF" strokeWidth={2.6} />
                ) : (
                  <Txt variant="heading" weight="bold" color={t.colors.primaryDeep}>
                    {num(item.repeat - count)}
                  </Txt>
                )}
              </Pressable>
            )}
            <IconButton icon={RotateCcw} label={tr('إعادة عدّ هذا الذكر', 'Recount this dhikr')} tone="plain" disabled={count === 0} onPress={() => onResetItem(item)} />
            <IconButton icon={Heart} label={tr('المفضلة', 'Favourite')} tone="plain" color={fav ? t.colors.danger : undefined} onPress={() => toggleFavorite(item.key)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
