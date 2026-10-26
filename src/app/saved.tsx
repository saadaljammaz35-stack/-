import { router } from 'expo-router';
import { Bookmark, BookOpen, Gem, Heart, HeartOff, ScrollText, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, EmptyState, IconButton, Loading, ReadingText, Segmented, Txt } from '@/components/ui';
import { getDhikrByKey, getNames, type DhikrItem, type NameOfAllah } from '@/data/content';
import { bookName } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { useAdhkarStore, useHadithStore, useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

type Tab = 'quran' | 'adhkar' | 'hadith' | 'names';

function QuranTab() {
  const t = useTheme();
  const { tr } = useI18n();
  const { bookmarks, lastRead, removeBookmark } = useQuranStore();
  if (!bookmarks.length && !lastRead) {
    return <EmptyState icon={Bookmark} title={tr('لا علامات بعد', 'No bookmarks yet')} message={tr('اضغط مطولًا على آية في المصحف لحفظها.', 'Long-press an ayah in the mushaf to bookmark it.')} />;
  }
  return (
    <View style={{ gap: 10 }}>
      {lastRead ? (
        <Card tone="soft" onPress={() => router.push({ pathname: '/mushaf', params: lastRead.verseId ? { verse: String(lastRead.verseId) } : { page: String(lastRead.page) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BookOpen size={20} color={t.colors.primaryDeep} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('متابعة القراءة', 'Continue reading')}</Txt>
            <Txt variant="caption" muted>
              {tr(`الصفحة ${lastRead.page}`, `Page ${lastRead.page}`)}
            </Txt>
          </View>
        </Card>
      ) : null}
      {bookmarks.map((b) => (
        <Card key={b.verseId} onPress={() => router.push({ pathname: '/mushaf', params: b.verseId > 0 ? { verse: String(b.verseId) } : { page: String(b.page) } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bookmark size={20} color={t.colors.primary} fill={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{b.label}</Txt>
            <Txt variant="caption" muted>
              {`${tr('الصفحة', 'Page')} ${b.page} — ${new Date(b.createdAt).toLocaleDateString()}`}
            </Txt>
          </View>
          <IconButton icon={HeartOff} label={tr('إزالة', 'Remove')} tone="plain" size={36} onPress={() => removeBookmark(b.verseId)} />
        </Card>
      ))}
    </View>
  );
}

function AdhkarTab({ keys }: { keys: string[] }) {
  const t = useTheme();
  const { tr } = useI18n();
  const toggle = useAdhkarStore((s) => s.toggleFavorite);
  const [items, setItems] = useState<DhikrItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(keys.map((k) => getDhikrByKey(k))).then((list) => alive && setItems(list.filter((x): x is DhikrItem => x !== null)));
    return () => {
      alive = false;
    };
  }, [keys]);

  if (!keys.length) {
    return <EmptyState icon={Sparkles} title={tr('لا أذكار في المفضلة', 'No favourite adhkar')} message={tr('اضغط على القلب في أي ذكر أو دعاء لإضافته هنا.', 'Tap the heart on any dhikr or dua to add it here.')} />;
  }
  if (!items) return <Loading />;
  return (
    <View style={{ gap: 10 }}>
      {items.map((d) => (
        <Card key={d.key} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `item:${d.key}` } })} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt variant="caption" weight="semibold" color={t.colors.primary} numberOfLines={1} style={{ flex: 1 }}>
              {d.chapterTitle ?? d.reference}
            </Txt>
            <IconButton icon={Heart} label={tr('إزالة من المفضلة', 'Remove')} tone="plain" size={34} color={t.colors.danger} onPress={() => toggle(d.key)} />
          </View>
          <ReadingText size={17} selectable={false}>
            {d.text.length > 280 ? `${d.text.slice(0, 280)}…` : d.text}
          </ReadingText>
        </Card>
      ))}
    </View>
  );
}

function HadithTab() {
  const t = useTheme();
  const { tr } = useI18n();
  const { favorites, toggle } = useHadithStore();
  if (!favorites.length) {
    return <EmptyState icon={ScrollText} title={tr('لا أحاديث في المفضلة', 'No favourite hadiths')} message={tr('اضغط على القلب في أي حديث لحفظه.', 'Tap the heart on any hadith to save it.')} />;
  }
  return (
    <View style={{ gap: 10 }}>
      {favorites.map((f) => (
        <Card
          key={f.kind === 'book' ? `${f.book}:${f.n}` : `enc:${f.id}`}
          onPress={() =>
            f.kind === 'book'
              ? router.push({ pathname: '/hadith/view', params: { book: f.book, n: String(f.n) } })
              : router.push({ pathname: '/hadith/enc/[id]', params: { id: String(f.id) } })
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ScrollText size={20} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" numberOfLines={2}>
              {f.title}
            </Txt>
            <Txt variant="caption" muted>
              {f.kind === 'book' ? bookName(f.book) : tr('موسوعة الأحاديث النبوية', 'HadeethEnc')}
            </Txt>
          </View>
          <IconButton icon={Heart} label={tr('إزالة من المفضلة', 'Remove')} tone="plain" size={34} color={t.colors.danger} onPress={() => toggle(f, f.title)} />
        </Card>
      ))}
    </View>
  );
}

function NamesTab({ keys }: { keys: string[] }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [names, setNames] = useState<NameOfAllah[] | null>(null);
  useEffect(() => {
    getNames().then(setNames);
  }, []);
  if (!keys.length) {
    return <EmptyState icon={Gem} title={tr('لا أسماء في المفضلة', 'No favourite names')} message={tr('افتح اسمًا من أسماء الله الحسنى واضغط على القلب.', 'Open a name of Allah and tap the heart.')} />;
  }
  if (!names) return <Loading />;
  const chosen = keys.map((k) => names.find((n) => `name:${n.n}` === k)).filter((n): n is NameOfAllah => Boolean(n));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {chosen.map((n) => (
        <Card key={n.n} padded={false} onPress={() => router.push({ pathname: '/names/[n]', params: { n: String(n.n) } })} style={{ paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' }}>
          <Txt variant="heading" color={t.colors.primaryDeep} style={{ fontFamily: t.fonts.reading }}>
            {n.name}
          </Txt>
        </Card>
      ))}
    </View>
  );
}

export default function SavedScreen() {
  const { tr } = useI18n();
  const [tab, setTab] = useState<Tab>('quran');
  const favorites = useAdhkarStore((s) => s.favorites);
  const adhkarKeys = useMemo(() => favorites.filter((k) => !k.startsWith('name:')), [favorites]);
  const nameKeys = useMemo(() => favorites.filter((k) => k.startsWith('name:')), [favorites]);

  return (
    <Screen title={tr('المحفوظات والمفضلة', 'Saved & favourites')}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'quran', label: tr('القرآن', 'Quran') },
          { value: 'adhkar', label: tr('الأذكار', 'Adhkar') },
          { value: 'hadith', label: tr('الأحاديث', 'Hadith') },
          { value: 'names', label: tr('الأسماء', 'Names') },
        ]}
      />
      {tab === 'quran' ? <QuranTab /> : tab === 'adhkar' ? <AdhkarTab keys={adhkarKeys} /> : tab === 'hadith' ? <HadithTab /> : <NamesTab keys={nameKeys} />}
    </Screen>
  );
}
