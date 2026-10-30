// «قاموس ألفاظ الحديث»: the word meanings HadeethEnc gives under each hadith, searchable by the word
// or by its meaning, each leading back to its hadith.
import { router } from 'expo-router';
import { BookA, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, EmptyState, Loading, Txt } from '@/components/ui';
import { searchGlossary, type GlossaryEntry } from '@/data/content';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export default function Glossary() {
  const t = useTheme();
  const { tr } = useI18n();
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ q: string; hits: GlossaryEntry[] } | null>(null);
  const hits = result?.q === q ? result.hits : null;

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => searchGlossary(q)
          .then((r) => alive && setResult({ q, hits: r }))
          .catch(() => alive && setResult({ q, hits: [] })), 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q]);

  return (
    <Screen title={tr('قاموس ألفاظ الحديث', 'Hadith glossary')} subtitle={tr('معاني الكلمات كما شرحتها موسوعة الأحاديث', 'Word meanings as explained by HadeethEnc')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, borderWidth: 1, borderColor: t.colors.border }}>
        <Search size={18} color={t.colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder={tr('اكتب كلمة، مثل: البر، الحياء، الكبر', 'Type a word, e.g. al-birr')} placeholderTextColor={t.colors.textFaint} style={{ flex: 1, paddingVertical: 11, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }} />
      </View>
      {q.trim().length < 2 ? (
        <EmptyState icon={BookA} title={tr('ابحث عن كلمة', 'Search for a word')} message={tr('أكثر من ألفين وخمسمئة حديث شُرحت ألفاظها.', 'Words explained in over 2,500 hadiths.')} />
      ) : !hits ? (
        <Loading />
      ) : hits.length ? (
        hits.map((h, i) => (
          <Card key={`${h.hadithId}-${i}`} onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(h.hadithId) } })} style={{ gap: 4 }}>
            <Txt weight="bold" color={t.colors.primaryDeep}>
              {h.word}
            </Txt>
            <Txt style={{ lineHeight: 24 }}>{h.meaning}</Txt>
            <Txt variant="caption" muted numberOfLines={1}>
              {tr(`في حديث: ${h.title}`, `In: ${h.title}`)}
            </Txt>
          </Card>
        ))
      ) : (
        <Txt muted center>
          {tr('لا نتائج.', 'No results.')}
        </Txt>
      )}
    </Screen>
  );
}
