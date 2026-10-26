import { router } from 'expo-router';
import { BookOpen, Gem, HandHeart, ScrollText, Search } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/screen';
import { Card, EmptyState, Loading, QuranText, ReadingText, SectionHeader, Txt } from '@/components/ui';
import { getNames, getSurahs, getVerseByKey, parseVerseKey, searchEnc, searchHisn, searchQuran, type DhikrItem, type EncHadith, type NameOfAllah, type QuranHit, type Surah } from '@/data/content';
import { bookName, searchHadiths, type Hadith } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { normalizeArabic, toArabicDigits } from '@/lib/arabic';
import { useTheme } from '@/theme';

type Results = {
  surahs: Surah[];
  page: number | null;
  verses: QuranHit[];
  adhkar: DhikrItem[];
  enc: EncHadith[];
  hadiths: Hadith[];
  names: NameOfAllah[];
};

const PREVIEW = 4;

async function runSearch(q: string): Promise<Results> {
  const n = normalizeArabic(q);
  const page = /^\d{1,3}$/.test(q) && Number(q) >= 1 && Number(q) <= 604 ? Number(q) : null;
  const key = parseVerseKey(q);
  const [surahs, verses, adhkar, enc, hadiths, names] = await Promise.all([
    getSurahs().then((all) => all.filter((s) => normalizeArabic(s.name).includes(n) || s.nameEn.toLowerCase().includes(q.toLowerCase()) || String(s.id) === q)),
    key ? getVerseByKey(key.surah, key.ayah).then((v) => (v ? [{ ...v, surahName: '' }] : [])) : searchQuran(q, 40),
    searchHisn(q, 20),
    searchEnc(q, 20),
    searchHadiths(q, null, 20).catch(() => []),
    getNames().then((all) => all.filter((x) => normalizeArabic(x.name).includes(n))),
  ]);
  return { surahs, page, verses, adhkar, enc, hadiths, names };
}

function Section({ title, total, more, children }: { title: string; total: number; more?: () => void; children: ReactNode }) {
  const { tr } = useI18n();
  if (!total) return null;
  return (
    <View style={{ gap: 10 }}>
      <SectionHeader title={`${title} (${total})`} action={more && total > PREVIEW ? tr('عرض الكل', 'See all') : undefined} onAction={more} />
      {children}
    </View>
  );
}

export default function GlobalSearch() {
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ q: string; results: Results } | null>(null);
  const trimmed = query.trim();
  const searchable = trimmed.length >= 2 || /^\d+$/.test(trimmed);
  const results = searchable && state?.q === trimmed ? state.results : null;
  const busy = searchable && state?.q !== trimmed;

  useEffect(() => {
    const q = query.trim();
    if (!q || (q.length < 2 && !/^\d+$/.test(q))) return;
    let alive = true;
    const id = setTimeout(async () => {
      const r = await runSearch(q).catch(() => null);
      if (alive && r) setState({ q, results: r });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  const total = results ? results.surahs.length + results.verses.length + results.adhkar.length + results.enc.length + results.hadiths.length + results.names.length + (results.page ? 1 : 0) : 0;
  const q = query.trim();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BackButton />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            placeholder={tr('ابحث في القرآن والأذكار والأحاديث…', 'Search Quran, adhkar, hadith…')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: t.isRTL ? 'right' : 'left' }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 60 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {!results ? (
          busy ? (
            <Loading />
          ) : (
            <EmptyState
              icon={Search}
              title={tr('بحث شامل', 'Search everything')}
              message={tr('اسم سورة، رقم صفحة، رقم آية مثل 2:255، كلمات من آية أو ذكر أو حديث. البحث لا يتأثر بالتشكيل.', 'A surah name, page number, a key like 2:255, or words from an ayah, dhikr or hadith. Diacritics are ignored.')}
            />
          )
        ) : total === 0 && !busy ? (
          <EmptyState icon={Search} title={tr('لا نتائج', 'No results')} message={tr('جرّب كلمة أخرى.', 'Try another word.')} />
        ) : (
          <>
            {results.page ? (
              <Card onPress={() => router.push({ pathname: '/mushaf', params: { page: String(results.page) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <BookOpen size={20} color={t.colors.primaryDeep} />
                <Txt weight="semibold">{tr(`الذهاب إلى الصفحة ${results.page}`, `Go to page ${results.page}`)}</Txt>
              </Card>
            ) : null}

            <Section title={tr('السور', 'Surahs')} total={results.surahs.length}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {results.surahs.slice(0, 12).map((s) => (
                  <Card key={s.id} padded={false} onPress={() => router.push({ pathname: '/mushaf', params: { page: String(s.pageStart) } })} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                    <Txt weight="semibold">{`${toArabicDigits(s.id)}. ${s.name}`}</Txt>
                  </Card>
                ))}
              </View>
            </Section>

            <Section title={tr('آيات', 'Verses')} total={results.verses.length} more={() => router.push({ pathname: '/quran/search', params: { q } })}>
              {results.verses.slice(0, PREVIEW).map((v) => (
                <Card key={v.id} onPress={() => router.push({ pathname: '/mushaf', params: { verse: String(v.id) } })} style={{ gap: 6 }}>
                  <Txt variant="caption" weight="semibold" color={t.colors.primary}>
                    {`${v.surahName ? `سورة ${v.surahName} ` : ''}${v.surah}:${v.ayah}`}
                  </Txt>
                  <QuranText size={20} style={{ textAlign: 'right' }}>{`${v.textQpc} ${toArabicDigits(v.ayah)}`}</QuranText>
                </Card>
              ))}
            </Section>

            <Section title={tr('الأذكار والأدعية', 'Adhkar & duas')} total={results.adhkar.length}>
              {results.adhkar.slice(0, PREVIEW * 2).map((d) => (
                <Card key={d.key} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: d.chapterId ? `hisn:${d.chapterId}` : `item:${d.key}` } })} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <HandHeart size={14} color={t.colors.primary} />
                    <Txt variant="caption" weight="semibold" color={t.colors.primary} numberOfLines={1} style={{ flex: 1 }}>
                      {d.chapterTitle ?? ''}
                    </Txt>
                  </View>
                  <ReadingText size={17} selectable={false}>
                    {d.text.length > 260 ? `${d.text.slice(0, 260)}…` : d.text}
                  </ReadingText>
                </Card>
              ))}
            </Section>

            <Section title={tr('الأحاديث', 'Hadith')} total={results.enc.length + results.hadiths.length} more={() => router.push({ pathname: '/hadith/search', params: { q } })}>
              {results.enc.slice(0, PREVIEW).map((h) => (
                <Card key={`enc${h.id}`} onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(h.id) } })} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ScrollText size={14} color={t.colors.primary} />
                    <Txt variant="caption" weight="semibold" color={t.colors.primary} numberOfLines={1} style={{ flex: 1 }}>
                      {`${h.attribution} — ${h.grade}`}
                    </Txt>
                  </View>
                  <ReadingText size={17} selectable={false}>
                    {h.text.length > 260 ? `${h.text.slice(0, 260)}…` : h.text}
                  </ReadingText>
                </Card>
              ))}
              {results.hadiths.slice(0, PREVIEW).map((h) => (
                <Card key={`b${h.id}`} onPress={() => router.push({ pathname: '/hadith/view', params: { book: h.book, n: String(h.n) } })} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ScrollText size={14} color={t.colors.primary} />
                    <Txt variant="caption" weight="semibold" color={t.colors.primary}>
                      {`${bookName(h.book)} ${h.display}`}
                    </Txt>
                  </View>
                  <ReadingText size={17} selectable={false}>
                    {h.text.length > 260 ? `${h.text.slice(0, 260)}…` : h.text}
                  </ReadingText>
                </Card>
              ))}
            </Section>

            <Section title={tr('أسماء الله الحسنى', 'Names of Allah')} total={results.names.length}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {results.names.map((nm) => (
                  <Card key={nm.n} padded={false} onPress={() => router.push({ pathname: '/names/[n]', params: { n: String(nm.n) } })} style={{ paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Gem size={14} color={t.colors.primary} />
                    <Txt weight="semibold">{nm.name}</Txt>
                  </Card>
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}
