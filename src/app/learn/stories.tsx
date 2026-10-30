// «قصص من الحديث الصحيح»: the stories of earlier nations, of the Quran and of the Prophet's life ﷺ,
// as HadeethEnc classifies them.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, Loading, Txt } from '@/components/ui';
import { getEncByCategory, type EncHadith } from '@/data/content';
import { useI18n } from '@/i18n';

const SHELVES: { id: number; ar: string; en: string }[] = [
  { id: 407, ar: 'الأمم السابقة', en: 'Earlier nations' },
  { id: 33, ar: 'قصص القرآن', en: 'Quranic stories' },
  { id: 367, ar: 'السيرة النبوية', en: 'The Prophet’s life' },
];

export default function Stories() {
  const { tr } = useI18n();
  const [shelf, setShelf] = useState(SHELVES[0].id);
  const [lists, setLists] = useState<Record<number, EncHadith[]>>({});

  useEffect(() => {
    if (lists[shelf]) return;
    getEncByCategory(shelf, 80).then((l) => setLists((x) => ({ ...x, [shelf]: l })));
  }, [shelf, lists]);

  const list = lists[shelf];
  return (
    <Screen title={tr('قصص من الحديث الصحيح', 'Stories from authentic hadith')}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {SHELVES.map((s) => (
          <Chip key={s.id} label={tr(s.ar, s.en)} active={shelf === s.id} onPress={() => setShelf(s.id)} />
        ))}
      </View>
      {!list ? (
        <Loading />
      ) : (
        list.map((h) => (
          <Card key={h.id} onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(h.id) } })} style={{ gap: 6 }}>
            <Txt weight="semibold">{h.title}</Txt>
            <Txt variant="caption" muted numberOfLines={2}>
              {h.text}
            </Txt>
            <Txt variant="caption" muted>{`${h.attribution.split('\n')[0]} · ${h.grade.split('\n')[0]}`}</Txt>
          </Card>
        ))
      )}
      <Txt variant="caption" muted center>
        {tr('من موسوعة الأحاديث النبوية (HadeethEnc.com)', 'From HadeethEnc.com')}
      </Txt>
    </Screen>
  );
}
