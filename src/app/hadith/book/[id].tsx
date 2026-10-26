import { router, useLocalSearchParams } from 'expo-router';
import { Hash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, ForwardChevron, Txt } from '@/components/ui';
import { BOOKS, findByNumber, getSections, type Section } from '@/features/hadith/books';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

export default function BookScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = BOOKS.find((b) => b.id === id);
  const [sections, setSections] = useState<Section[]>([]);
  const [number, setNumber] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getSections(id).then(setSections);
  }, [id]);

  const jump = async () => {
    const h = await findByNumber(id, number.trim());
    if (h) router.push({ pathname: '/hadith/view', params: { book: id, n: String(h.n) } });
    else setNotFound(true);
  };

  return (
    <Screen title={meta?.name ?? ''} subtitle={meta?.author} scroll={false}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: t.colors.border }}>
            <Hash size={18} color={t.colors.textMuted} />
            <TextInput
              value={number}
              onChangeText={(v) => (setNumber(v.replace(/[^0-9]/g, '')), setNotFound(false))}
              keyboardType="number-pad"
              placeholder={tr('انتقل إلى رقم الحديث', 'Go to hadith number')}
              placeholderTextColor={t.colors.textFaint}
              onSubmitEditing={jump}
              style={{ flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: 'right' }}
            />
          </View>
          <Button title={tr('انتقال', 'Go')} onPress={jump} disabled={!number} />
        </View>
        {notFound ? (
          <Txt variant="caption" color={t.colors.danger}>
            {tr('لا يوجد حديث بهذا الرقم في هذه النسخة.', 'No hadith with this number in this edition.')}
          </Txt>
        ) : null}
      </View>
      <FlatList
        data={sections}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/hadith/section', params: { book: id, section: String(item.id), title: item.title } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' })}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="caption" weight="bold" color={t.colors.primaryDeep}>
                {item.id}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="medium">{item.title}</Txt>
              <Txt variant="caption" muted>
                {tr(`${item.count} حديثًا`, `${item.count} hadiths`)}
              </Txt>
            </View>
            <ForwardChevron />
          </Pressable>
        )}
      />
    </Screen>
  );
}
