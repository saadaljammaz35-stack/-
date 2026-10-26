import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpenText,
  Copy,
  Languages,
  List,
  Pause,
  Play,
  Search,
  Share2,
  SquarePen,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/screen';
import { IconButton, QuranText, Row, Segmented, Txt } from '@/components/ui';
import { getPageVerses, getSurahs, getVerse, getVerseByKey, type Surah, type Verse } from '@/data/content';
import { getPageTranslation, TRANSLATIONS } from '@/data/remote';
import { usePlayer } from '@/features/audio/player';
import { openShare } from '@/features/home/daily-cards';
import { useMushafNav } from '@/features/mushaf/nav';
import { MushafPage } from '@/features/mushaf/page';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { TOTAL_PAGES } from '@/lib/khatma';
import { useSettings } from '@/store/settings';
import { useActivityStore, useKhatmaStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => TOTAL_PAGES - i); // 604 … 1, so page 1 sits at the right edge

function VerseSheet({ verse, surah, onClose }: { verse: Verse; surah: Surah; onClose: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const player = usePlayer();
  const bookmarks = useQuranStore((s) => s.bookmarks);
  const toggleBookmark = useQuranStore((s) => s.toggleBookmark);
  const khatmas = useKhatmaStore((s) => s.khatmas);
  const readKhatma = useKhatmaStore((s) => s.read);
  const today = useToday();
  const insets = useSafeAreaInsets();
  const bookmarked = bookmarks.some((b) => b.verseId === verse.id);
  const active = khatmas.find((k) => k.status === 'active');
  const ref = `سورة ${surah.name}: ${verse.ayah}`;
  const text = `${verse.textQpc} ${toArabicDigits(verse.ayah)}`;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.colors.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 10, maxHeight: '75%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{ref}</Txt>
            <Txt variant="caption" muted>
              {tr(`الصفحة ${verse.page} — الجزء ${verse.juz}`, `Page ${verse.page} — Juz ${verse.juz}`)}
            </Txt>
          </View>
          <IconButton icon={X} label={tr('إغلاق', 'Close')} onPress={onClose} size={38} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
          <QuranText size={22}>{text}</QuranText>
        </ScrollView>
        <View style={{ marginTop: 8 }}>
          <Row icon={Play} title={tr('استماع من هذه الآية', 'Listen from this ayah')} onPress={() => (player.playSurah(verse.surah, verse.ayah), onClose())} />
          <Row icon={BookOpenText} title={tr('التفسير ومقارنة التفاسير', 'Tafsir & comparison')} onPress={() => (onClose(), router.push({ pathname: '/tafsir', params: { key: `${verse.surah}:${verse.ayah}` } }))} />
          <Row
            icon={bookmarked ? BookmarkCheck : BookmarkPlus}
            title={bookmarked ? tr('إزالة العلامة المرجعية', 'Remove bookmark') : tr('إضافة علامة مرجعية', 'Bookmark')}
            onPress={() => (toggleBookmark({ verseId: verse.id, page: verse.page, label: ref }), onClose())}
          />
          {active ? (
            <Row
              icon={SquarePen}
              title={tr(`تسجيل القراءة حتى الصفحة ${verse.page} في «${active.name}»`, `Mark read up to page ${verse.page}`)}
              onPress={() => (readKhatma(active.id, verse.page, today), onClose())}
            />
          ) : null}
          <Row icon={Copy} title={tr('نسخ الآية', 'Copy')} onPress={() => (Clipboard.setStringAsync(`${verse.textUthmani} ﴿${verse.ayah}﴾\n[${ref}]`), onClose())} />
          <Row icon={Share2} title={tr('مشاركة كبطاقة', 'Share as card')} onPress={() => (onClose(), openShare({ title: tr('من القرآن الكريم', 'From the Quran'), text, reference: ref, quran: true }))} />
        </View>
      </View>
    </Modal>
  );
}

function TranslationList({ page, onVerse }: { page: number; onVerse: (v: Verse) => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const translationId = useSettings((s) => s.translationId);
  const quranScale = useSettings((s) => s.quranScale);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loaded, setLoaded] = useState<{ key: string; map: Map<string, string> | null } | null>(null);
  const translationKey = `${translationId}:${page}`;
  const translation = loaded?.key === translationKey ? loaded.map : null;
  const error = loaded?.key === translationKey && loaded.map === null;
  useEffect(() => {
    getPageVerses(page).then(setVerses);
    getSurahs().then(setSurahs);
    const key = `${translationId}:${page}`;
    getPageTranslation(translationId, page)
      .then((map) => setLoaded({ key, map }))
      .catch(() => setLoaded({ key, map: null }));
  }, [page, translationId]);
  const info = TRANSLATIONS.find((x) => x.id === translationId);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}>
      <Txt variant="caption" muted center>
        {info ? `${info.language} — ${info.name}` : ''}
      </Txt>
      {verses.map((v) => (
        <Pressable key={v.id} onPress={() => onVerse(v)} style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 14, gap: 8 }}>
          <Txt variant="label" muted>{`${surahs[v.surah - 1]?.name ?? ''} ${v.ayah}`}</Txt>
          <QuranText size={Math.round(23 * quranScale)} style={{ textAlign: 'right' }}>{`${v.textQpc} ${toArabicDigits(v.ayah)}`}</QuranText>
          {translation ? (
            <Txt style={{ writingDirection: info?.language === 'اردو' ? 'rtl' : 'ltr' }}>{translation.get(`${v.surah}:${v.ayah}`) ?? ''}</Txt>
          ) : error ? (
            <Txt variant="caption" muted>
              {tr('الترجمة تحتاج إلى اتصال بالإنترنت في أول مرة.', 'The translation needs a connection the first time.')}
            </Txt>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function MushafScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const params = useLocalSearchParams<{ page?: string; verse?: string; surah?: string; ayah?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<number>>(null);
  const [page, setPage] = useState(() => Math.min(TOTAL_PAGES, Math.max(1, Number(params.page) || useQuranStore.getState().lastRead?.page || 1)));
  const [chrome, setChrome] = useState(true);
  const [mode, setMode] = useState<'mushaf' | 'translation'>('mushaf');
  const [selected, setSelected] = useState<{ verse: Verse; surah: Surah } | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const setLastRead = useQuranStore((s) => s.setLastRead);
  const record = useActivityStore((s) => s.record);
  const keepAwake = useSettings((s) => s.keepAwakeInMushaf);
  const player = usePlayer();

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  // Deep links: /mushaf?surah=2&ayah=255 or ?verse=<id>
  useEffect(() => {
    (async () => {
      let v: Verse | null = null;
      if (params.verse) v = await getVerse(Number(params.verse));
      else if (params.surah) v = await getVerseByKey(Number(params.surah), Number(params.ayah) || 1);
      if (v) {
        setPage(v.page);
        setHighlight(v.id);
        listRef.current?.scrollToIndex({ index: TOTAL_PAGES - v.page, animated: false });
      }
    })();
  }, [params.verse, params.surah, params.ayah]);

  // Jumps requested by the index while this screen stays open underneath it.
  useEffect(
    () =>
      useMushafNav.subscribe((s, prev) => {
        const req = s.request;
        if (!req || req === prev.request) return;
        setMode('mushaf');
        setPage(req.page);
        setHighlight(req.verse ?? null);
        listRef.current?.scrollToIndex({ index: TOTAL_PAGES - req.page, animated: false });
      }),
    [],
  );

  useEffect(() => {
    if (!keepAwake) return;
    activateKeepAwakeAsync('mushaf').catch(() => undefined);
    return () => {
      deactivateKeepAwake('mushaf').catch(() => undefined);
    };
  }, [keepAwake]);

  const surah = useMemo(() => [...surahs].reverse().find((s) => s.pageStart <= page), [surahs, page]);

  useEffect(() => {
    setLastRead(page, null);
    if (surah) record({ key: 'mushaf', title: `${surah.name} - ${tr('الصفحة', 'Page')} ${page}`, route: `/mushaf?page=${page}`, icon: 'book' });
  }, [page, surah, setLastRead, record, tr]);

  // Follow the reciter: highlight the verse being recited and turn pages with it.
  const playingVerseKey = player.now?.kind === 'quran' && player.now.ayah ? `${player.now.surah}:${player.now.ayah}` : null;
  const [active, setActive] = useState<{ key: string; id: number } | null>(null);
  const activeVerse = playingVerseKey && active?.key === playingVerseKey ? active.id : null;
  useEffect(() => {
    if (!playingVerseKey) return;
    const [s, a] = playingVerseKey.split(':').map(Number);
    getVerseByKey(s, a).then((v) => {
      if (!v) return;
      setActive({ key: playingVerseKey, id: v.id });
      if (v.page !== page && player.playing) {
        setPage(v.page);
        listRef.current?.scrollToIndex({ index: TOTAL_PAGES - v.page, animated: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingVerseKey]);

  const onVerse = useCallback(async (id: number) => {
    const v = await getVerse(id);
    const s = await getSurahs();
    if (v) setSelected({ verse: v, surah: s[v.surah - 1] });
  }, []);

  const pageHeight = height - insets.top - insets.bottom;
  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <Pressable onPress={() => setChrome((c) => !c)} style={{ width, height, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: t.colors.mushafPaper }}>
        <MushafPage
          page={item}
          width={width}
          height={pageHeight}
          activeVerse={activeVerse ?? highlight}
          selectedVerse={selected?.verse.id ?? null}
          onVersePress={() => setChrome((c) => !c)}
          onVerseLongPress={onVerse}
          onBackgroundPress={() => setChrome((c) => !c)}
        />
      </Pressable>
    ),
    [width, height, pageHeight, insets.top, insets.bottom, activeVerse, highlight, selected, onVerse, t.colors.mushafPaper],
  );

  const playingThisSurah = player.now?.kind === 'quran' && surah && player.now.surah === surah.id && player.playing;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.mushafPaper }}>
      {mode === 'mushaf' ? (
        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(p) => String(p)}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          style={{ direction: 'ltr' }}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={TOTAL_PAGES - page}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setPage(TOTAL_PAGES - index);
            setHighlight(null);
          }}
        />
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top + 64 }}>
          <TranslationList page={page} onVerse={(v) => onVerse(v.id)} />
        </View>
      )}

      {chrome ? (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: t.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
            <BackButton />
            <Pressable style={{ flex: 1 }} onPress={() => router.push('/quran-index')}>
              <Txt weight="semibold" numberOfLines={1}>
                {surah ? `سورة ${surah.name}` : ''}
              </Txt>
              <Txt variant="caption" muted>
                {tr(`الصفحة ${page}`, `Page ${page}`)}
              </Txt>
            </Pressable>
            <IconButton icon={List} label={tr('الفهرس', 'Index')} onPress={() => router.push('/quran-index')} size={40} />
            <IconButton icon={Search} label={tr('البحث', 'Search')} onPress={() => router.push('/quran/search')} size={40} />
            <IconButton icon={Languages} label={tr('الترجمة', 'Translation')} onPress={() => setMode((m) => (m === 'mushaf' ? 'translation' : 'mushaf'))} size={40} tone={mode === 'translation' ? 'primary' : 'soft'} />
          </View>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 10, paddingTop: 10, paddingHorizontal: 16, backgroundColor: t.colors.surface, borderTopWidth: 1, borderTopColor: t.colors.border, gap: 10 }}>
            {mode === 'translation' ? (
              <Segmented
                value={String(useSettings.getState().translationId)}
                options={TRANSLATIONS.slice(0, 4).map((x) => ({ value: String(x.id), label: x.language }))}
                onChange={(v) => useSettings.getState().set({ translationId: Number(v) })}
              />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconButton
                icon={playingThisSurah ? Pause : Play}
                label={tr('استماع', 'Listen')}
                tone="primary"
                onPress={() => {
                  if (playingThisSurah) player.toggle();
                  else if (surah) player.playSurah(surah.id, surah.pageStart === page ? 1 : undefined);
                }}
              />
              <Pressable style={{ flex: 1 }} onPress={() => router.push('/quran/reciters')}>
                <Txt variant="caption" muted>
                  {tr('القارئ', 'Reciter')}
                </Txt>
                <Txt weight="medium" numberOfLines={1}>
                  {player.now?.kind === 'quran' ? player.now.reciterName : tr('اختر القارئ والتحميل', 'Choose reciter & downloads')}
                </Txt>
              </Pressable>
              <IconButton
                icon={useQuranStore.getState().bookmarks.some((b) => b.page === page && b.verseId === -page) ? BookmarkCheck : BookmarkPlus}
                label={tr('حفظ الصفحة', 'Bookmark page')}
                onPress={() => useQuranStore.getState().toggleBookmark({ verseId: -page, page, label: `${surah?.name ?? ''} — ${tr('الصفحة', 'Page')} ${page}` })}
              />
            </View>
          </View>
        </>
      ) : null}

      {selected ? <VerseSheet verse={selected.verse} surah={selected.surah} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}
