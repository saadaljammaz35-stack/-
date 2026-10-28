import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';

import { Screen } from '@/components/screen';
import { Loading } from '@/components/ui';
import { listPerf } from '@/components/list';
import { bookName, getSectionHadiths, type Hadith } from '@/features/hadith/books';
import { HadithCard } from '@/features/hadith/hadith-card';
import { useI18n } from '@/i18n';
import { useActivityStore } from '@/store/user';

const PAGE = 30;

export default function SectionScreen() {
  const { tr } = useI18n();
  const { book, section, title } = useLocalSearchParams<{ book: string; section: string; title?: string }>();
  const [items, setItems] = useState<Hadith[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const record = useActivityStore((s) => s.record);

  const loadMore = useCallback(async () => {
    if (done || loading) return;
    setLoading(true);
    const next = await getSectionHadiths(book, Number(section), PAGE, items.length);
    setItems((prev) => [...prev, ...next]);
    if (next.length < PAGE) setDone(true);
    setLoading(false);
  }, [book, section, items.length, done, loading]);

  useEffect(() => {
    let alive = true;
    getSectionHadiths(book, Number(section), PAGE, 0).then((first) => {
      if (!alive) return;
      setItems(first);
      setDone(first.length < PAGE);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [book, section]);

  useEffect(() => {
    record({ key: `hadith:${book}:${section}`, title: `${bookName(book)} — ${title ?? ''}`, route: `/hadith/section?book=${book}&section=${section}&title=${encodeURIComponent(title ?? '')}`, icon: 'scroll' });
  }, [book, section, title, record]);

  return (
    <Screen title={title ?? tr('الأحاديث', 'Hadiths')} subtitle={bookName(book)} scroll={false}>
      <FlatList
        {...listPerf}
        data={items}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) => <HadithCard h={item} compact />}
        ListFooterComponent={loading ? <Loading /> : undefined}
      />
    </Screen>
  );
}
