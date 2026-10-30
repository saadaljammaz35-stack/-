import { router } from 'expo-router';
import { Bookmark, BookOpen, Search, Trash, UsersRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { StarMark } from '@/components/brand';
import { Chip, EmptyState, IconButton, Segmented, Txt } from '@/components/ui';
import { getJuzStarts, getSurahs, getVerse, type Surah } from '@/data/content';
import { useI18n } from '@/i18n';
import { normalizeArabic, toArabicDigits } from '@/lib/arabic';
import { readingMinutes, secondsPerPage } from '@/lib/pace';
import { useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

type Tab = 'surahs' | 'juz' | 'bookmarks';

function NumberStar({ n }: { n: number }) {
  const t = useTheme();
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <StarMark size={44} fill={t.colors.primarySoft} strokeWidth={5} />
      </View>
      <Txt variant="caption" weight="bold" color={t.colors.primaryDeep}>
        {n}
      </Txt>
    </View>
  );
}

export function QuranIndex({ header, bottomInset = 0, onSelect }: { header?: React.ReactElement; bottomInset?: number; onSelect?: (page: number, verse?: number) => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [tab, setTab] = useState<Tab>('surahs');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [juz, setJuz] = useState<{ n: number; page: number; label: string }[]>([]);
  const [query, setQuery] = useState('');
  const bookmarks = useQuranStore((s) => s.bookmarks);
  const removeBookmark = useQuranStore((s) => s.removeBookmark);
  const readers = useQuranStore((s) => s.readers);
  const spp = secondsPerPage(useQuranStore((s) => s.pace));
  const [byRevelation, setByRevelation] = useState(false);
  /** «≈ ١٢ دقيقة» at the reader's own pace, once it is known. */
  const minutes = (pages: number) => (spp ? tr(`≈ ${readingMinutes(pages, spp)} د`, `≈ ${readingMinutes(pages, spp)} min`) : null);

  useEffect(() => {
    (async () => {
      const s = await getSurahs();
      setSurahs(s);
      const starts = await getJuzStarts();
      const items = [];
      for (let i = 0; i < starts.length; i++) {
        const v = await getVerse(starts[i]);
        if (v) items.push({ n: i + 1, page: v.page, label: `${s[v.surah - 1].name} ${v.ayah}` });
      }
      setJuz(items);
    })();
  }, []);

  const open = (page: number, extra?: { verse: string }) => {
    if (onSelect) onSelect(page, extra ? Number(extra.verse) : undefined);
    else router.push({ pathname: '/mushaf', params: { page: String(page), ...extra } });
  };

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    const list = byRevelation ? [...surahs].sort((a, b) => a.revelationOrder - b.revelationOrder) : surahs;
    if (!q) return list;
    return list.filter((s) => normalizeArabic(s.name).includes(q) || s.nameSimple.toLowerCase().includes(query.toLowerCase()) || String(s.id) === query.trim());
  }, [surahs, query, byRevelation]);

  const head = (
    <View style={{ gap: 14, paddingHorizontal: 20, paddingBottom: 12 }}>
      {header}
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'surahs', label: tr('السور', 'Surahs') },
          { value: 'juz', label: tr('الأجزاء', 'Juz') },
          { value: 'bookmarks', label: tr('العلامات', 'Bookmarks') },
        ]}
      />
      {tab === 'surahs' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={18} color={t.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('ابحث باسم السورة أو رقمها', 'Find a surah by name or number')}
            placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, minWidth: 0, paddingVertical: 11, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }}
          />
          <Pressable onPress={() => router.push('/quran/search')} style={{ flexShrink: 0 }}>
            <Txt variant="caption" color={t.colors.primary}>
              {tr('بحث في الآيات', 'Search verses')}
            </Txt>
          </Pressable>
        </View>
      ) : null}
      {tab === 'surahs' ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Txt variant="caption" color={t.colors.primary} onPress={() => router.push('/quran/sleep')}>
              {tr('ورد النوم', 'Bedtime wird')}
            </Txt>
            <Txt variant="caption" color={t.colors.primary} onPress={() => router.push('/quran/marks')}>
              {tr('علامات المصحف', 'Mushaf marks')}
            </Txt>
            <Txt variant="caption" color={t.colors.primary} onPress={() => router.push('/quran/read')}>
              {tr('مصحف لقارئ الشاشة', 'Screen-reader mushaf')}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={tr('ترتيب المصحف', 'Mushaf order')} active={!byRevelation} onPress={() => setByRevelation(false)} />
            <Chip label={tr('ترتيب النزول', 'Order of revelation')} active={byRevelation} onPress={() => setByRevelation(true)} />
          </View>
          {byRevelation ? (
            <Txt variant="caption" muted style={{ lineHeight: 20 }}>
              {tr(
                'الترتيب المشهور المثبت في المصحف المصري (مصدر البيانات: Quran.com). وهو ترتيب تقريبي مبني على روايات اجتهد فيها العلماء واختلفوا في بعض السور؛ أما ترتيب المصحف فتوقيفي.',
                'The well-known order printed in the Egyptian standard mushaf (data: Quran.com). It is approximate, built on reports scholars weighed and differed over for some surahs; the mushaf’s own order is fixed by revelation.',
              )}
            </Txt>
          ) : null}
          {spp ? (
            <Txt variant="caption" muted>
              {tr(`سرعتك في القراءة نحو ${Math.round(spp)} ثانية للصفحة، والأوقات بجانب السور على قدرها.`, `You read about one page every ${Math.round(spp)} seconds; the times beside each surah follow your pace.`)}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (tab === 'bookmarks') {
    return (
      <FlatList
        data={bookmarks}
        keyExtractor={(b) => String(b.verseId)}
        ListHeaderComponent={
          <>
            {head}
            {readers.map((r) => (
              <Pressable key={r.id} onPress={() => open(r.page)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
                <UsersRound size={20} color={t.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Txt weight="medium">{tr(`وقف ${r.name} هنا`, `${r.name} stopped here`)}</Txt>
                  <Txt variant="caption" muted>
                    {tr(`الصفحة ${r.page}`, `Page ${r.page}`)}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </>
        }
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListEmptyComponent={readers.length ? undefined : <EmptyState icon={Bookmark} title={tr('لا توجد علامات بعد', 'No bookmarks yet')} message={tr('اضغط مطولًا على أي آية في المصحف لإضافة علامة.', 'Long-press any ayah in the mushaf to bookmark it.')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item.page, item.verseId >= 0 ? { verse: String(item.verseId) } : undefined)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Bookmark size={20} color={t.colors.primary} fill={t.colors.primarySoft} />
            <View style={{ flex: 1 }}>
              <Txt weight="medium">{item.label}</Txt>
              <Txt variant="caption" muted>
                {tr(`الصفحة ${item.page}`, `Page ${item.page}`)}
              </Txt>
            </View>
            <IconButton icon={Trash} label={tr('حذف', 'Delete')} tone="plain" size={36} onPress={() => removeBookmark(item.verseId)} />
          </Pressable>
        )}
      />
    );
  }

  if (tab === 'juz') {
    return (
      <FlatList
        data={juz}
        keyExtractor={(j) => String(j.n)}
        ListHeaderComponent={head}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item.page)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
            <NumberStar n={item.n} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold">{tr(`الجزء ${toArabicDigits(item.n)}`, `Juz ${item.n}`)}</Txt>
              <Txt variant="caption" muted>
                {[item.label, minutes(20)].filter(Boolean).join(' • ')}
              </Txt>
            </View>
            <Txt variant="caption" muted>
              {tr(`ص ${item.page}`, `p. ${item.page}`)}
            </Txt>
          </Pressable>
        )}
      />
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(s) => String(s.id)}
      ListHeaderComponent={head}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      initialNumToRender={20}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item.pageStart)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
          <NumberStar n={byRevelation ? item.revelationOrder : item.id} />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontFamily: t.fonts.readingBold, fontSize: t.fs(20), lineHeight: t.fs(30) }} color={t.colors.text}>
              {`سورة ${item.name}`}
            </Txt>
            <Txt variant="caption" muted>
              {[
                item.revelation === 'meccan' ? tr('مكية', 'Meccan') : tr('مدنية', 'Medinan'),
                tr(`${item.versesCount} آية`, `${item.versesCount} ayat`),
                byRevelation ? tr(`رقمها في المصحف ${item.id}`, `No. ${item.id} in the mushaf`) : item.nameSimple,
                minutes(item.pageEnd - item.pageStart + 1),
              ]
                .filter(Boolean)
                .join(' • ')}
            </Txt>
          </View>
          <View style={{ alignItems: 'center' }}>
            <BookOpen size={16} color={t.colors.textFaint} />
            <Txt variant="label" muted>
              {item.pageStart}
            </Txt>
          </View>
        </Pressable>
      )}
    />
  );
}
