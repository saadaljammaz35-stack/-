import { router } from 'expo-router';
import { BookOpen, HandHeart, ScrollText, Share2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Card, IconButton, QuranText, ReadingText, Txt } from '@/components/ui';
import { getDailyAyah, getDailyDua, getDailyHadith, type DhikrItem, type EncHadith } from '@/data/content';
import { useI18n } from '@/i18n';
import type { CivilDate } from '@/lib/hijri';
import { useTheme } from '@/theme';

export function openShare(p: { title: string; text: string; reference: string; quran?: boolean; wallpaper?: boolean }) {
  router.push({ pathname: '/share', params: { title: p.title, text: p.text, reference: p.reference, quran: p.quran ? '1' : '0', ...(p.wallpaper ? { shape: 'wallpaper' } : {}) } });
}

function Tag({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4, width: 64 }}>
      <View style={{ backgroundColor: t.colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', gap: 2 }}>
        <Txt variant="label" weight="semibold" color={t.colors.primaryDeep}>
          {label}
        </Txt>
        <Icon size={16} color={t.colors.primaryDeep} />
      </View>
    </View>
  );
}

export function DailyCards({ today }: { today: CivilDate }) {
  const t = useTheme();
  const { tr } = useI18n();
  const [ayah, setAyah] = useState<DhikrItem | null>(null);
  const [hadith, setHadith] = useState<EncHadith | null>(null);
  const [dua, setDua] = useState<DhikrItem | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getDailyAyah(today), getDailyHadith(today), getDailyDua(today)]).then(([a, h, d]) => {
      if (!alive) return;
      setAyah(a);
      setHadith(h);
      setDua(d);
    });
    return () => {
      alive = false;
    };
  }, [today]);

  if (!ayah || !hadith || !dua) return null;
  return (
    <View style={{ gap: 12 }}>
      <Card onPress={() => router.push({ pathname: '/tafsir', params: { key: ayah.key.replace('quran:', '').split('-')[0] } })}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tag icon={BookOpen} label={tr('آية اليوم', 'Ayah')} />
          <View style={{ flex: 1, gap: 6 }}>
            <QuranText size={21} style={{ textAlign: 'auto' }}>
              {ayah.text}
            </QuranText>
            <Txt variant="caption" muted>
              {ayah.reference}
            </Txt>
          </View>
          <IconButton icon={Share2} label={tr('مشاركة', 'Share')} onPress={() => openShare({ title: tr('آية اليوم', 'Ayah of the day'), text: ayah.text, reference: ayah.reference, quran: true })} />
        </View>
      </Card>
      <Card onPress={() => router.push({ pathname: '/hadith/enc/[id]', params: { id: String(hadith.id) } })}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tag icon={ScrollText} label={tr('حديث اليوم', 'Hadith')} />
          <View style={{ flex: 1, gap: 6 }}>
            <ReadingText size={18}>{hadith.text}</ReadingText>
            <Txt variant="caption" muted>
              {`${hadith.attribution} — ${hadith.grade}`}
            </Txt>
          </View>
          <IconButton icon={Share2} label={tr('مشاركة', 'Share')} onPress={() => openShare({ title: tr('حديث اليوم', 'Hadith of the day'), text: hadith.text, reference: `${hadith.attribution} — ${tr('الدرجة', 'Grade')}: ${hadith.grade}` })} />
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tag icon={HandHeart} label={tr('دعاء اليوم', 'Dua')} />
          <View style={{ flex: 1, gap: 6 }}>
            <QuranText size={20} style={{ textAlign: 'auto' }}>
              {dua.text}
            </QuranText>
            <Txt variant="caption" muted>
              {dua.by ? `${dua.by} — ${dua.reference}` : dua.reference}
            </Txt>
          </View>
          <IconButton icon={Share2} label={tr('مشاركة', 'Share')} onPress={() => openShare({ title: tr('دعاء اليوم', 'Dua of the day'), text: dua.text, reference: dua.reference, quran: true })} />
        </View>
      </Card>
      <Txt variant="label" muted center style={{ color: t.colors.textFaint }}>
        {tr('الأحاديث من موسوعة الأحاديث النبوية HadeethEnc.com دون تعديل', 'Hadiths from HadeethEnc.com, unmodified')}
      </Txt>
    </View>
  );
}
