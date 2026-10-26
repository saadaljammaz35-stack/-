import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Info, Link2, Search, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { jsonStorage, storageKey } from '@/store/storage';
import { useTheme } from '@/theme';

type Source = { id: string; ar: string; en: string; search: (q: string) => string; browse: string };

// Official websites. Where a site has no direct search URL, the search is restricted to it.
const SOURCES: Source[] = [
  {
    id: 'binbaz',
    ar: 'فتاوى الشيخ عبد العزيز بن باز',
    en: 'Shaykh Ibn Baz',
    search: (q) => `https://binbaz.org.sa/search?type=fatwa&q=${encodeURIComponent(q)}`,
    browse: 'https://binbaz.org.sa/fatwas',
  },
  {
    id: 'uthaymeen',
    ar: 'فتاوى الشيخ محمد بن صالح العثيمين',
    en: 'Shaykh Ibn Uthaymeen',
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(`site:binothaimeen.net ${q}`)}`,
    browse: 'https://binothaimeen.net/site/fatwa',
  },
  {
    id: 'lajnah',
    ar: 'اللجنة الدائمة للبحوث العلمية والإفتاء',
    en: 'Permanent Committee (alifta.gov.sa)',
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(`site:alifta.gov.sa ${q}`)}`,
    browse: 'https://www.alifta.gov.sa',
  },
  {
    id: 'islamqa',
    ar: 'موقع الإسلام سؤال وجواب',
    en: 'IslamQA',
    search: (q) => `https://islamqa.info/ar/search?q=${encodeURIComponent(q)}`,
    browse: 'https://islamqa.info/ar',
  },
];

type Saved = { url: string; title: string; at: number };
const useSavedFatwas = create<{ items: Saved[]; add: (s: Saved) => void; remove: (url: string) => void }>()(
  persist(
    (set) => ({
      items: [],
      add: (s) => set((st) => ({ items: [s, ...st.items.filter((x) => x.url !== s.url)] })),
      remove: (url) => set((st) => ({ items: st.items.filter((x) => x.url !== url) })),
    }),
    { name: storageKey('fatwas'), storage: jsonStorage },
  ),
);

export default function FatwaScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState(SOURCES[0].id);
  const [title, setTitle] = useState('');
  const saved = useSavedFatwas();
  const s = SOURCES.find((x) => x.id === source)!;

  const open = (url: string) => WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => undefined);

  const savePasted = async () => {
    const url = (await Clipboard.getStringAsync()).trim();
    if (!/^https?:\/\//.test(url)) return;
    saved.add({ url, title: title.trim() || url, at: Date.now() });
    setTitle('');
  };

  return (
    <Screen title={tr('الفتاوى والبحث الشرعي', 'Fatwas')}>
      <Card tone="soft" style={{ flexDirection: 'row', gap: 10 }}>
        <Info size={20} color={t.colors.primaryDeep} />
        <Txt variant="caption" style={{ flex: 1 }}>
          {tr(
            'لا يُصدر التطبيق أحكامًا شرعية ولا يولّد فتاوى. يبحث في المواقع الرسمية للعلماء ويعرض الفتوى في مصدرها الأصلي برابطها. في مسائل الخلاف يُنقل قول كل عالم كما هو دون نسبته إلى الإجماع، وللمسائل الخاصة يُرجع إلى أهل العلم مباشرة.',
            'The app does not issue rulings. It searches scholars’ official websites and opens each fatwa at its original source. Differing opinions are shown as stated, never as consensus.',
          )}
        </Txt>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SOURCES.map((x) => (
          <Chip key={x.id} label={tr(x.ar, x.en)} active={x.id === source} onPress={() => setSource(x.id)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
        <Search size={18} color={t.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => query.trim() && open(s.search(query.trim()))}
          returnKeyType="search"
          placeholder={tr('اكتب سؤالك أو موضوع البحث', 'Type your question or topic')}
          placeholderTextColor={t.colors.textFaint}
          style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }}
        />
      </View>
      <Button title={tr(`بحث في: ${s.ar}`, `Search ${s.en}`)} icon={Search} disabled={!query.trim()} onPress={() => open(s.search(query.trim()))} />
      <Button title={tr('تصفح الفتاوى حسب الموضوع', 'Browse by topic')} icon={ExternalLink} tone="soft" onPress={() => open(s.browse)} />

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('فتاواي المحفوظة', 'Saved fatwas')}</Txt>
        <Txt variant="caption" muted>
          {tr('انسخ رابط الفتوى من صفحتها ثم اضغط «حفظ الرابط المنسوخ».', 'Copy the fatwa link from its page, then tap “Save copied link”.')}
        </Txt>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={tr('عنوان الفتوى (اختياري)', 'Title (optional)')}
          placeholderTextColor={t.colors.textFaint}
          style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 10, fontFamily: t.fonts.regular, color: t.colors.text, textAlign: 'right' }}
        />
        <Button title={tr('حفظ الرابط المنسوخ', 'Save copied link')} icon={Link2} tone="soft" onPress={savePasted} />
        {saved.items.map((x) => (
          <View key={x.url} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable style={{ flex: 1 }} onPress={() => open(x.url)}>
              <Txt weight="medium" numberOfLines={1}>
                {x.title}
              </Txt>
              <Txt variant="label" muted numberOfLines={1}>
                {x.url}
              </Txt>
            </Pressable>
            <IconButton icon={Trash} label={tr('حذف', 'Delete')} tone="plain" size={34} onPress={() => saved.remove(x.url)} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
