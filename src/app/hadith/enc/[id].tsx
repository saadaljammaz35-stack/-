import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, Heart, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Card, Loading, ReadingText, Txt } from '@/components/ui';
import { getEncHadith, type EncHadith } from '@/data/content';
import { openShare } from '@/features/home/daily-cards';
import { useI18n } from '@/i18n';
import { gradeTone } from '@/lib/hadith-grades';
import { useActivityStore, useHadithStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function EncHadithScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [h, setH] = useState<EncHadith | null>(null);
  const isFav = useHadithStore((s) => s.favorites.some((f) => f.kind === 'enc' && f.id === Number(id)));
  const toggle = useHadithStore((s) => s.toggle);
  const record = useActivityStore((s) => s.record);
  useEffect(() => {
    getEncHadith(Number(id)).then((x) => {
      setH(x);
      if (x) record({ key: `enc:${x.id}`, title: x.title, route: `/hadith/enc/${x.id}`, icon: 'scroll' });
    });
  }, [id, record]);
  if (!h) return <Screen title={tr('الحديث', 'Hadith')}><Loading /></Screen>;
  return (
    <Screen
      title={h.title}
      actions={[
        { icon: Heart, label: tr('المفضلة', 'Favourite'), onPress: () => toggle({ kind: 'enc', id: h.id }, h.title) },
        { icon: Copy, label: tr('نسخ', 'Copy'), onPress: () => Clipboard.setStringAsync(`${h.text}\n[${h.attribution} — ${h.grade}]`) },
        { icon: Share2, label: tr('مشاركة', 'Share'), onPress: () => openShare({ title: tr('حديث نبوي', 'Hadith'), text: h.text, reference: `${h.attribution} — ${tr('الدرجة', 'Grade')}: ${h.grade}` }) },
      ]}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={h.attribution} />
          <Badge label={h.grade} tone={gradeTone(h.grade)} />
          {isFav ? <Heart size={18} color={t.colors.danger} fill={t.colors.danger} /> : null}
        </View>
        <ReadingText size={21}>{h.text}</ReadingText>
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {tr('الشرح', 'Explanation')}
        </Txt>
        <ReadingText size={18}>{h.explanation}</ReadingText>
      </Card>
      {h.hints.length ? (
        <Card style={{ gap: 8 }}>
          <Txt weight="semibold" color={t.colors.primaryDeep}>
            {tr('من فوائد الحديث', 'Benefits')}
          </Txt>
          {h.hints.map((x, i) => (
            <Txt key={i}>{`• ${x}`}</Txt>
          ))}
        </Card>
      ) : null}
      {h.meanings.length ? (
        <Card style={{ gap: 6 }}>
          <Txt weight="semibold" color={t.colors.primaryDeep}>
            {tr('معاني الكلمات', 'Word meanings')}
          </Txt>
          {h.meanings.map((m, i) => (
            <Txt key={i}>
              <Txt weight="semibold">{m.word}: </Txt>
              {m.meaning}
            </Txt>
          ))}
        </Card>
      ) : null}
      <Card style={{ gap: 6 }}>
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {tr('المراجع', 'References')}
        </Txt>
        <Txt variant="caption" muted>
          {h.reference}
        </Txt>
        <Txt variant="label" muted>
          {tr('المصدر: موسوعة الأحاديث النبوية HadeethEnc.com — منقول دون تعديل', 'Source: HadeethEnc.com — unmodified')}
        </Txt>
      </Card>
    </Screen>
  );
}
