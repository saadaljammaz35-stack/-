import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, GalleryHorizontal, Headphones, List, ListChecks, MoonStar, RotateCcw, Zap } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Loading, ProgressBar, Txt } from '@/components/ui';
import { listPerf } from '@/components/list';
import { getAdhkarCategories, getDhikrByKey, getDuaCategories, getHisnChapterItems, getHisnChapters, resolveSources, type DhikrItem } from '@/data/content';
import { DhikrCard } from '@/features/adhkar/dhikr-card';
import { DhikrReader } from '@/features/adhkar/dhikr-reader';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { civilKey } from '@/lib/hijri';
import { fromSahihayn } from '@/lib/adhkar-short';
import { ALL_SITUATIONS } from '@/lib/situations';
import { useSettings } from '@/store/settings';
import { adhkarProgressKey, useActivityStore, useAdhkarStore } from '@/store/user';
import { useTheme } from '@/theme';

/**
 * Lists adhkar with counters. `id` is an adhkar category ("morning"), a dua category
 * ("dua:grief"), a Hisn al-Muslim chapter ("hisn:27") or a situation ("situation:rain").
 */
export default function AdhkarList() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [all, setItems] = useState<DhikrItem[] | null>(null);
  /** «المختصر»: only what al-Bukhari or Muslim reported, for the morning and evening lists. */
  const shortable = id === 'morning' || id === 'evening';
  const [short, setShort] = useState(false);
  const items = useMemo(() => (all && shortable && short ? all.filter((i) => i.kind === 'morning-evening' && fromSahihayn(i.reference)) : all), [all, shortable, short]);
  const today = useToday();
  const progress = useAdhkarStore((s) => s.progress[civilKey(today)]);
  const increment = useAdhkarStore((s) => s.increment);
  const resetKeys = useAdhkarStore((s) => s.resetKeys);
  const record = useActivityStore((s) => s.record);

  useEffect(() => {
    let alive = true;
    (async () => {
      let name = '';
      let list: DhikrItem[] = [];
      if (id.startsWith('item:')) {
        const item = await getDhikrByKey(id.slice(5));
        if (!alive) return;
        setTitle(item?.chapterTitle ?? tr('ذكر', 'Dhikr'));
        setItems(item ? [item] : []);
        return;
      } else if (id.startsWith('hisn:')) {
        const chapterId = Number(id.slice(5));
        name = (await getHisnChapters()).find((c) => c.id === chapterId)?.title ?? '';
        list = await getHisnChapterItems(chapterId);
      } else if (id.startsWith('situation:')) {
        const situation = ALL_SITUATIONS.find((x) => x.id === id.slice(10));
        name = situation ? tr(situation.ar, situation.en) : '';
        list = situation ? await resolveSources(situation.chapters.map((hisnChapter) => ({ hisnChapter }))) : [];
      } else if (id.startsWith('dua:')) {
        const cat = (await getDuaCategories()).find((c) => c.id === id.slice(4));
        name = cat?.title ?? '';
        list = cat ? await resolveSources(cat.sources) : [];
      } else {
        const cat = (await getAdhkarCategories()).find((c) => c.id === id);
        name = cat?.title ?? '';
        list = cat ? await resolveSources(cat.sources) : [];
      }
      if (!alive) return;
      setTitle(name);
      setItems(list);
      if (name) record({ key: `adhkar:${id}`, title: name, route: `/adhkar/${id}`, icon: 'sparkles' });
    })();
    return () => {
      alive = false;
    };
  }, [id, record, tr]);

  const counted = useMemo(() => (items ?? []).filter((i) => i.kind !== 'surah'), [items]);
  const pk = (item: DhikrItem) => adhkarProgressKey(id, item.key);
  const counts = useMemo(() => Object.fromEntries((items ?? []).map((i) => [i.key, progress?.[adhkarProgressKey(id, i.key)] ?? 0])), [items, progress, id]);
  const done = counted.filter((i) => counts[i.key] >= i.repeat).length;
  const view = useSettings((s) => s.adhkarView);
  const setSettings = useSettings((s) => s.set);
  const paged = view === 'pages' && (items?.length ?? 0) > 1;

  return (
    <Screen
      title={title || tr('الأذكار', 'Adhkar')}
      subtitle={items ? (short && shortable ? tr(`المختصر من الصحيحين · أنجزت ${done} من ${counted.length}`, `Short (al-Bukhari and Muslim) · ${done} of ${counted.length}`) : tr(`أنجزت ${done} من ${counted.length}`, `${done} of ${counted.length} done`)) : undefined}
      actions={[
        ...((items?.length ?? 0) > 1
          ? [{ icon: view === 'pages' ? List : GalleryHorizontal, label: view === 'pages' ? tr('عرض كقائمة', 'Show as list') : tr('عرض كصفحات', 'Show as pages'), onPress: () => setSettings({ adhkarView: view === 'pages' ? 'list' : 'pages' }) }]
          : []),
        ...(shortable ? [{ icon: Headphones, label: tr('استمع متتابعًا', 'Listen in sequence'), onPress: () => router.push({ pathname: '/adhkar/listen', params: { id } }) }] : []),
        ...(shortable ? [{ icon: short ? ListChecks : Zap, label: short ? tr('الأذكار كاملة', 'All the adhkar') : tr('المختصر من الصحيحين', 'Short: al-Bukhari and Muslim only'), onPress: () => setShort((v) => !v) }] : []),
        ...(id === 'sleep'
          ? [
              { icon: BookOpen, label: tr('ورد النوم من القرآن', 'Bedtime Quran'), onPress: () => router.push('/quran/sleep') },
              { icon: MoonStar, label: tr('الوضع الهادئ', 'Calm mode'), onPress: () => router.push('/adhkar/sleep-calm') },
            ]
          : []),
        { icon: RotateCcw, label: tr('إعادة العدّ', 'Reset'), onPress: () => resetKeys(today, counted.map(pk)) },
      ]}
      scroll={false}>
      {!items ? (
        <Loading />
      ) : paged ? (
        <DhikrReader
          items={items}
          counts={counts}
          onCount={(item) => increment(today, pk(item), item.repeat)}
          onResetItem={(item) => resetKeys(today, [pk(item)])}
          onResetAll={() => resetKeys(today, counted.map(pk))}
        />
      ) : (
        <FlatList
          {...listPerf}
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
          ListHeaderComponent={
            counted.length ? (
              <View style={{ gap: 6, marginBottom: 4 }}>
                <ProgressBar value={counted.length ? done / counted.length : 0} />
                {done === counted.length ? (
                  <Txt variant="caption" color={t.colors.primary} center>
                    {tr('تقبّل الله منك', 'May Allah accept from you')}
                  </Txt>
                ) : null}
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <DhikrCard item={item} index={index} count={counts[item.key] ?? 0} onCount={item.kind === 'surah' ? undefined : () => increment(today, pk(item), item.repeat)} />
          )}
        />
      )}
    </Screen>
  );
}
