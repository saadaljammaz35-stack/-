import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState, QuranText, Txt } from '@/components/ui';
import { listPerf } from '@/components/list';
import { getVerseByKey, parseVerseKey, searchQuran, type QuranHit } from '@/data/content';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useTheme } from '@/theme';

export default function QuranSearch() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [result, setResult] = useState<{ q: string; hits: QuranHit[] } | null>(null);
  const trimmed = query.trim();
  const active = trimmed.length >= 2;
  const hits = active && result?.q === trimmed ? result.hits : null;
  const busy = active && result?.q !== trimmed;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = setTimeout(async () => {
      const key = parseVerseKey(q);
      if (key) {
        const v = await getVerseByKey(key.surah, key.ayah);
        setResult({ q, hits: v ? [{ ...v, surahName: '' }] : [] });
      } else {
        setResult({ q, hits: await searchQuran(q) });
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <Screen title={tr('البحث في القرآن', 'Search the Quran')} scroll={false}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={tr('اكتب كلمة أو جزءًا من آية، أو رقمًا مثل 2:255', 'Type words from an ayah, or a key like 2:255')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }}
          />
        </View>
        {hits || busy ? (
          <Txt variant="caption" muted style={{ marginTop: 8 }}>
            {busy || !hits ? tr('جارٍ البحث…', 'Searching…') : tr(`${hits.length === 200 ? 'أكثر من 200' : hits.length} نتيجة`, `${hits.length} results`)}
          </Txt>
        ) : null}
      </View>
      <FlatList
        {...listPerf}
        data={hits ?? []}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          hits && !busy ? (
            <EmptyState icon={Search} title={tr('لا نتائج', 'No results')} message={tr('جرّب كلمة أخرى؛ البحث لا يتأثر بالتشكيل أو الهمزات.', 'Try another word; search ignores diacritics.')} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/mushaf', params: { verse: String(item.id) } })} style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 14, gap: 6 }}>
            <Txt variant="caption" weight="semibold" color={t.colors.primary}>
              {`${item.surahName ? `سورة ${item.surahName}` : ''} ${item.surah}:${item.ayah} — ${tr('الصفحة', 'Page')} ${item.page}`}
            </Txt>
            <QuranText size={20} style={{ textAlign: 'right' }}>{`${item.textQpc} ${toArabicDigits(item.ayah)}`}</QuranText>
          </Pressable>
        )}
      />
    </Screen>
  );
}
