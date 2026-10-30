// «بطاقات أذكار الصغار»: a child's everyday adhkar as flip cards — the moment on the front, the
// words on the back — from Hisn al-Muslim.
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { IconButton, Loading, Txt } from '@/components/ui';
import { getHisnChapterItems, type DhikrItem } from '@/data/content';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const CARDS: { chapter: number; emoji: string; ar: string; en: string }[] = [
  { chapter: 1, emoji: '🌅', ar: 'ماذا أقول حين أستيقظ؟', en: 'What do I say when I wake up?' },
  { chapter: 69, emoji: '🍽️', ar: 'ماذا أقول قبل الأكل؟', en: 'What do I say before eating?' },
  { chapter: 70, emoji: '😋', ar: 'ماذا أقول بعد الأكل؟', en: 'What do I say after eating?' },
  { chapter: 77, emoji: '🤧', ar: 'ماذا أقول إذا عطست؟', en: 'What do I say when I sneeze?' },
  { chapter: 10, emoji: '🚪', ar: 'ماذا أقول حين أخرج من البيت؟', en: 'What do I say leaving home?' },
  { chapter: 11, emoji: '🏠', ar: 'ماذا أقول حين أدخل البيت؟', en: 'What do I say coming home?' },
  { chapter: 6, emoji: '🚿', ar: 'ماذا أقول قبل دخول الخلاء؟', en: 'Before entering the washroom?' },
  { chapter: 7, emoji: '✨', ar: 'ماذا أقول بعد الخروج من الخلاء؟', en: 'After leaving the washroom?' },
  { chapter: 2, emoji: '👕', ar: 'ماذا أقول حين ألبس ثوبي؟', en: 'What do I say getting dressed?' },
  { chapter: 95, emoji: '🚗', ar: 'ماذا أقول حين أركب؟', en: 'What do I say when riding?' },
  { chapter: 82, emoji: '😠', ar: 'ماذا أقول إذا غضبت؟', en: 'What do I say when angry?' },
];

export default function KidsCards() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const [items, setItems] = useState<Record<number, DhikrItem>>({});
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    Promise.all(CARDS.map((c) => getHisnChapterItems(c.chapter).then((l) => [c.chapter, [...l].sort((a, b) => a.text.length - b.text.length)[0]] as const))).then((e) =>
      setItems(Object.fromEntries(e.filter(([, x]) => x)) as Record<number, DhikrItem>),
    );
  }, []);

  const card = CARDS[i];
  const item = items[card.chapter];
  const go = (d: number) => {
    setFlipped(false);
    setI((x) => (x + d + CARDS.length) % CARDS.length);
  };
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const Prev = isRTL ? ChevronRight : ChevronLeft;

  return (
    <Screen title={tr('بطاقات أذكار الصغار', 'Kids’ adhkar cards')} subtitle={tr(`${i + 1} من ${CARDS.length} · المس البطاقة لتقلبها`, `${i + 1} of ${CARDS.length} · tap to flip`)}>
      {!item ? (
        <Loading />
      ) : (
        <Pressable
          onPress={() => setFlipped((f) => !f)}
          accessibilityRole="button"
          style={{ minHeight: 360, borderRadius: 28, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: flipped ? t.colors.surface : t.colors.fill, borderWidth: 1, borderColor: t.colors.border }}>
          {flipped ? (
            <>
              <Txt center style={{ fontFamily: t.fonts.reading, fontSize: t.rs(24), lineHeight: t.rs(44) }}>
                {item.text.replace(/\s*\(\d+\)/g, '')}
              </Txt>
              <Txt variant="caption" muted center>
                {tr('من حصن المسلم', 'From Hisn al-Muslim')}
              </Txt>
            </>
          ) : (
            <>
              <Txt style={{ fontSize: 72, lineHeight: 90 }}>{card.emoji}</Txt>
              <Txt variant="title" color="#FFFFFF" center>
                {tr(card.ar, card.en)}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={16} color="rgba(255,255,255,0.8)" />
                <Txt color="rgba(255,255,255,0.8)">{tr('اقلبني', 'Flip me')}</Txt>
              </View>
            </>
          )}
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon={Prev} label={tr('السابقة', 'Previous')} onPress={() => go(-1)} size={56} />
        <IconButton icon={Next} label={tr('التالية', 'Next')} onPress={() => go(1)} size={56} tone="primary" />
      </View>
    </Screen>
  );
}
