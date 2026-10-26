import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, ChevronLeft, ChevronRight, Columns2, History, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Loading, QuranText, ReadingText, Tap, Txt } from '@/components/ui';
import { getAsbab, getBundledTafsir, getBundledTafsirSources, getSurahs, getVerseByKey, type Asbab, type Surah, type TafsirSource, type Verse } from '@/data/content';
import { getOnlineTafsir, getVerseTranslation, ONLINE_TAFSIRS, OfflineError } from '@/data/remote';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

type SourceId = string; // 'muyassar' | 'saadi' | 'online:<id>'

type TafsirState = { text: string | null; note: string | null; error: 'offline' | 'failed' | null; loading: boolean };
const LOADING: TafsirState = { text: null, note: null, error: null, loading: true };

function useTafsir(source: SourceId, verse: Verse | null): TafsirState {
  const [state, setState] = useState<{ key: string; value: TafsirState } | null>(null);
  const key = verse ? `${source}|${verse.id}` : '';
  useEffect(() => {
    if (!verse) return;
    let alive = true;
    const k = `${source}|${verse.id}`;
    (async () => {
      try {
        if (source.startsWith('online:')) {
          const text = await getOnlineTafsir(Number(source.split(':')[1]), verse.surah, verse.ayah);
          if (alive) setState({ key: k, value: { text: text || null, note: null, error: null, loading: false } });
        } else {
          const r = await getBundledTafsir(source, verse.id);
          const note = r && r.fromVerse !== verse.id ? `shared:${r.fromVerse}` : null;
          if (alive) setState({ key: k, value: { text: r?.text ?? null, note, error: null, loading: false } });
        }
      } catch (err) {
        if (alive) setState({ key: k, value: { text: null, note: null, error: err instanceof OfflineError ? 'offline' : 'failed', loading: false } });
      }
    })();
    return () => {
      alive = false;
    };
  }, [source, verse]);
  return state?.key === key ? state.value : LOADING;
}

function AsbabSection({ verse }: { verse: Verse }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [loaded, setLoaded] = useState<{ id: number; list: Asbab[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    getAsbab(verse.id).then((list) => alive && setLoaded({ id: verse.id, list }));
    return () => {
      alive = false;
    };
  }, [verse.id]);
  const list = loaded?.id === verse.id ? loaded.list : [];
  if (!list.length) return null;
  return (
    <Card tone="soft" style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <History size={18} color={t.colors.primaryDeep} />
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {tr('سبب النزول', 'Occasion of revelation')}
        </Txt>
      </View>
      {list.map((a) => {
        const expanded = open === a.id || a.text.length < 700;
        return (
          <View key={a.id} style={{ gap: 6 }}>
            <Txt variant="caption" muted>
              {a.toAyah > a.fromAyah ? tr(`الآيات ${a.fromAyah}–${a.toAyah}`, `Ayat ${a.fromAyah}–${a.toAyah}`) : tr(`الآية ${a.fromAyah}`, `Ayah ${a.fromAyah}`)}
            </Txt>
            <ReadingText size={17}>{expanded ? a.text : `${a.text.slice(0, 600)}…`}</ReadingText>
            {a.text.length >= 700 ? (
              <Chip label={expanded ? tr('عرض أقل', 'Show less') : tr('عرض النص كاملًا', 'Show full text')} onPress={() => setOpen(expanded ? null : a.id)} />
            ) : null}
            {expanded && a.footnotes.length ? (
              <Txt variant="caption" muted>
                {a.footnotes.join('\n')}
              </Txt>
            ) : null}
            <Tap onPress={() => WebBrowser.openBrowserAsync('https://app.turath.io/book/11547')} accessibilityRole="link">
              <Txt variant="label" color={t.colors.primary}>
                {tr(`«الصحيح المسند من أسباب النزول» لمقبل بن هادي الوادعي — ص ${a.bookPage}`, `al-Wadi'i, al-Sahih al-Musnad min Asbab al-Nuzul, p. ${a.bookPage}`)}
              </Txt>
            </Tap>
          </View>
        );
      })}
    </Card>
  );
}

function TafsirBody({ source, verse, title }: { source: SourceId; verse: Verse; title?: string }) {
  const t = useTheme();
  const { tr } = useI18n();
  const s = useTafsir(source, verse);
  return (
    <Card style={{ gap: 10 }}>
      {title ? (
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {title}
        </Txt>
      ) : null}
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <View style={{ alignItems: 'center', gap: 6, padding: 10 }}>
          <WifiOff size={22} color={t.colors.textMuted} />
          <Txt muted center>
            {s.error === 'offline'
              ? tr('هذا التفسير يُحمّل من الإنترنت ويُحفظ للاستخدام دون اتصال بعد أول فتح. التفسير الميسر والسعدي متاحان دون إنترنت.', 'This tafsir loads online once, then works offline. Al-Muyassar and al-Sa‘di are always offline.')
              : tr('تعذر تحميل التفسير.', 'Could not load the tafsir.')}
          </Txt>
        </View>
      ) : s.text ? (
        <>
          {s.note ? (
            <Txt variant="caption" muted>
              {tr('تفسير هذه الآية مذكور مع ما قبلها:', 'Explained together with the preceding verses:')}
            </Txt>
          ) : null}
          <ReadingText size={18}>{s.text}</ReadingText>
        </>
      ) : (
        <Txt muted>{tr('لا يوجد تفسير لهذه الآية في هذا المصدر.', 'No commentary for this ayah in this source.')}</Txt>
      )}
    </Card>
  );
}

export default function TafsirScreen() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const params = useLocalSearchParams<{ key?: string }>();
  const [surah, ayah] = (params.key ?? '1:1').split(':').map(Number);
  const [key, setKey] = useState({ surah, ayah });
  const [verse, setVerse] = useState<Verse | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [bundled, setBundled] = useState<TafsirSource[]>([]);
  const [source, setSource] = useState<SourceId>('muyassar');
  const [compare, setCompare] = useState(false);
  const [loadedTranslation, setLoadedTranslation] = useState<{ key: string; text: string } | null>(null);
  const showTranslation = useSettings((s) => s.showTranslation);
  const translationId = useSettings((s) => s.translationId);
  const translationKey = `${translationId}:${key.surah}:${key.ayah}`;
  const translation = showTranslation && loadedTranslation?.key === translationKey ? loadedTranslation.text : null;

  useEffect(() => {
    getSurahs().then(setSurahs);
    getBundledTafsirSources().then(setBundled);
  }, []);
  useEffect(() => {
    getVerseByKey(key.surah, key.ayah).then(setVerse);
    const k = `${translationId}:${key.surah}:${key.ayah}`;
    if (showTranslation) getVerseTranslation(translationId, key.surah, key.ayah).then((text) => setLoadedTranslation({ key: k, text })).catch(() => undefined);
  }, [key, showTranslation, translationId]);

  const sources: { id: SourceId; name: string }[] = [
    ...bundled.map((b) => ({ id: b.id, name: b.name })),
    ...ONLINE_TAFSIRS.map((o) => ({ id: `online:${o.id}`, name: o.name })),
  ];
  const s = surahs[key.surah - 1];
  const step = (delta: number) => {
    if (!s) return;
    let next = { surah: key.surah, ayah: key.ayah + delta };
    if (next.ayah < 1 && key.surah > 1) next = { surah: key.surah - 1, ayah: surahs[key.surah - 2].versesCount };
    if (next.ayah > s.versesCount && key.surah < 114) next = { surah: key.surah + 1, ayah: 1 };
    if (next.ayah >= 1) setKey(next);
  };

  return (
    <Screen
      title={s ? `سورة ${s.name} — ${tr('آية', 'Ayah')} ${key.ayah}` : tr('التفسير', 'Tafsir')}
      actions={[{ icon: Columns2, label: tr('مقارنة التفاسير', 'Compare'), onPress: () => setCompare((c) => !c) }]}>
      {verse ? (
        <Card style={{ gap: 8 }}>
          <QuranText size={23}>{`${verse.textQpc} ${toArabicDigits(verse.ayah)}`}</QuranText>
          {translation ? <Txt muted>{translation}</Txt> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <IconButton icon={isRTL ? ChevronRight : ChevronLeft} label={tr('الآية السابقة', 'Previous ayah')} onPress={() => step(-1)} />
            <Button title={tr('في المصحف', 'In mushaf')} icon={BookOpen} tone="plain" onPress={() => router.push({ pathname: '/mushaf', params: { verse: String(verse.id) } })} />
            <IconButton icon={isRTL ? ChevronLeft : ChevronRight} label={tr('الآية التالية', 'Next ayah')} onPress={() => step(1)} />
          </View>
        </Card>
      ) : (
        <Loading />
      )}
      {verse ? <AsbabSection verse={verse} /> : null}
      {!compare ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {sources.map((x) => (
            <Chip key={x.id} label={x.name} active={x.id === source} onPress={() => setSource(x.id)} />
          ))}
        </ScrollView>
      ) : (
        <Txt variant="caption" muted>
          {tr('مقارنة: التفسير الميسر، السعدي، ابن كثير، الطبري', 'Comparing: al-Muyassar, al-Sa‘di, Ibn Kathir, al-Tabari')}
        </Txt>
      )}
      {verse ? (
        compare ? (
          ['muyassar', 'saadi', 'online:14', 'online:15'].map((id) => (
            <TafsirBody key={id} source={id} verse={verse} title={sources.find((x) => x.id === id)?.name} />
          ))
        ) : (
          <TafsirBody source={source} verse={verse} />
        )
      ) : null}
      <Txt variant="label" muted center style={{ color: t.colors.textFaint }}>
        {tr('نصوص التفاسير من Quran.com (مجمع الملك فهد ومصادر التفسير المعتمدة)', 'Tafsir texts via Quran.com')}
      </Txt>
    </Screen>
  );
}
