import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Chip, EmptyState, Txt } from '@/components/ui';
import { searchEnc, type EncHadith } from '@/data/content';
import { installedBooks, searchHadiths, type Hadith, type InstalledBook } from '@/features/hadith/books';
import { HadithCard } from '@/features/hadith/hadith-card';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type Hit = { kind: 'book'; h: Hadith } | { kind: 'enc'; h: EncHadith };

export default function HadithSearch() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [books, setBooks] = useState<InstalledBook[]>([]);
  const [scope, setScope] = useState<string>('all');
  const [result, setResult] = useState<{ key: string; hits: Hit[] } | null>(null);
  const searchKey = `${query.trim()}|${scope}`;
  const hits = query.trim().length >= 2 && result?.key === searchKey ? result.hits : null;

  useEffect(() => {
    installedBooks().then(setBooks);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const key = `${query.trim()}|${scope}`;
    const id = setTimeout(async () => {
      const [enc, book] = await Promise.all([
        scope === 'all' || scope === 'enc' ? searchEnc(query, 60) : Promise.resolve([]),
        scope === 'enc' ? Promise.resolve([]) : searchHadiths(query, scope === 'all' ? null : [scope], 150),
      ]);
      setResult({ key, hits: [...enc.map((h) => ({ kind: 'enc' as const, h })), ...book.map((h) => ({ kind: 'book' as const, h }))] });
    }, 300);
    return () => clearTimeout(id);
  }, [query, scope]);

  return (
    <Screen title={tr('البحث في الأحاديث', 'Search hadiths')} scroll={false}>
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={tr('اكتب كلمة من متن الحديث', 'Words from the hadith text')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }}
          />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: tr('الكل', 'All') }, { id: 'enc', name: tr('الموسوعة', 'Encyclopedia') }, ...books]}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip label={item.name} active={scope === item.id} onPress={() => setScope(item.id)} />}
        />
        {hits ? (
          <Txt variant="caption" muted>
            {tr(`${hits.length} نتيجة`, `${hits.length} results`)}
          </Txt>
        ) : null}
      </View>
      <FlatList
        data={hits ?? []}
        keyExtractor={(x) => `${x.kind}:${x.h.id}`}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={hits ? <EmptyState icon={Search} title={tr('لا نتائج', 'No results')} message={tr('البحث يشمل الكتب المحمّلة على جهازك والموسوعة.', 'Search covers downloaded books and the encyclopedia.')} /> : undefined}
        renderItem={({ item }) =>
          item.kind === 'book' ? (
            <HadithCard h={item.h} compact />
          ) : (
            <Pressable onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(item.h.id) } })} style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 14, gap: 4 }}>
              <Txt weight="medium">{item.h.title}</Txt>
              <Txt variant="caption" muted>{`${item.h.attribution} — ${item.h.grade}`}</Txt>
            </Pressable>
          )
        }
      />
    </Screen>
  );
}
