// «بطاقات التهنئة»: Ramadan and Eid greetings as cards in the app's design, with your name.
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Txt } from '@/components/ui';
import { getVerseByKey, type Verse } from '@/data/content';
import { inputStyle } from '@/features/group-ui';
import { openShare } from '@/features/home/daily-cards';
import { useI18n } from '@/i18n';
import { toArabicDigits } from '@/lib/arabic';
import { useGroupStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function Greetings() {
  const t = useTheme();
  const { tr } = useI18n();
  const savedName = useGroupStore((s) => s.name);
  const [name, setName] = useState(savedName);
  const [ramadanVerse, setRamadanVerse] = useState<Verse | null>(null);
  useEffect(() => {
    getVerseByKey(2, 185).then(setRamadanVerse);
  }, []);

  const from = name.trim() ? tr(`من: ${name.trim()}`, `From: ${name.trim()}`) : '';
  // The opening of al-Baqarah 185, up to its first pause mark.
  const opening = ramadanVerse ? ramadanVerse.textUthmani.split(' ').slice(0, 6).join(' ') : '';
  const cards = [
    { title: tr('رمضان مبارك', 'Ramadan Mubarak'), text: opening ? `﴿${opening}﴾ [البقرة: ${toArabicDigits(185)}]\n\nبلّغكم الله صيامه وقيامه` : 'بلّغكم الله صيامه وقيامه' },
    { title: tr('عيد الفطر', 'Eid al-Fitr'), text: 'عيدكم مبارك\nتقبّل الله منا ومنكم' },
    { title: tr('عيد الأضحى', 'Eid al-Adha'), text: 'عيدكم مبارك\nتقبّل الله منا ومنكم' },
    { title: tr('العشر من ذي الحجة', 'The ten days of Dhul-Hijjah'), text: 'أعاننا الله وإياكم على الطاعة\nفي أيام العشر المباركة' },
  ];

  return (
    <Screen title={tr('بطاقات التهنئة', 'Greeting cards')} subtitle={tr('بتصميم التطبيق وباسمك', 'In the app’s design, with your name')}>
      <View style={{ gap: 6 }}>
        <Txt variant="caption" muted>
          {tr('اسمك على البطاقة (اختياري)', 'Your name on the card (optional)')}
        </Txt>
        <TextInput value={name} onChangeText={setName} maxLength={40} placeholder={tr('مثل: عائلة أبي محمد', 'e.g. the Ahmad family')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
      </View>
      {cards.map((c) => (
        <Card key={c.title} onPress={() => openShare({ title: c.title, text: c.text, reference: from })} style={{ gap: 6 }}>
          <Txt variant="subheading">{c.title}</Txt>
          <Txt muted style={{ lineHeight: 24 }}>
            {c.text}
          </Txt>
        </Card>
      ))}
    </Screen>
  );
}
