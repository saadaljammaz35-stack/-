// «الوضوء والصلاة»: wudu as ʿUthman showed it, and the prayer position by position, each linked to
// what is said in it from Hisn al-Muslim.
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Droplets } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const UTHMAN_WUDU = 3313; // ʿUthman's wudu (agreed upon)
const PRAY_AS_I = 3059; // «صلّوا كما رأيتموني أصلي» (agreed upon)

const WUDU: { ar: string; en: string }[] = [
  { ar: 'غسل الكفين ثلاثًا', en: 'Wash the hands three times' },
  { ar: 'المضمضة والاستنشاق والاستنثار', en: 'Rinse the mouth and the nose' },
  { ar: 'غسل الوجه ثلاثًا', en: 'Wash the face three times' },
  { ar: 'غسل اليدين إلى المرفقين ثلاثًا، اليمنى ثم اليسرى', en: 'Wash the arms to the elbows three times, right then left' },
  { ar: 'مسح الرأس', en: 'Wipe the head' },
  { ar: 'غسل الرجلين إلى الكعبين ثلاثًا، اليمنى ثم اليسرى', en: 'Wash the feet to the ankles three times, right then left' },
];

const SALAH: { ar: string; en: string; chapter?: number }[] = [
  { ar: 'تكبيرة الإحرام ثم دعاء الاستفتاح', en: 'The opening takbir, then the opening dua', chapter: 16 },
  { ar: 'قراءة الفاتحة وما تيسّر', en: 'Al-Fatihah and what is easy' },
  { ar: 'الركوع', en: 'Bowing', chapter: 17 },
  { ar: 'الرفع من الركوع', en: 'Rising from bowing', chapter: 18 },
  { ar: 'السجود', en: 'Prostration', chapter: 19 },
  { ar: 'الجلسة بين السجدتين', en: 'Sitting between the prostrations', chapter: 20 },
  { ar: 'التشهد', en: 'The tashahhud', chapter: 22 },
  { ar: 'الصلاة على النبي ﷺ', en: 'Salawat on the Prophet ﷺ', chapter: 23 },
  { ar: 'الدعاء قبل السلام', en: 'Dua before the salam', chapter: 24 },
  { ar: 'الأذكار بعد السلام', en: 'Dhikr after the salam', chapter: 25 },
];

export default function WuduSalahGuide() {
  const t = useTheme();
  const { tr, isRTL } = useI18n();
  const [tab, setTab] = useState<'wudu' | 'salah'>('wudu');
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const hisn = (id: number) => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${id}` } });

  return (
    <Screen title={tr('الوضوء والصلاة', 'Wudu and prayer')} subtitle={tr('خطوة بخطوة من السنة', 'Step by step from the Sunnah')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={tr('الوضوء', 'Wudu')} active={tab === 'wudu'} onPress={() => setTab('wudu')} />
        <Chip label={tr('الصلاة', 'Prayer')} active={tab === 'salah'} onPress={() => setTab('salah')} />
      </View>
      {tab === 'wudu' ? (
        <>
          <Chip label={tr('الذكر قبل الوضوء', 'Before wudu')} onPress={() => hisn(8)} />
          <Card padded={false}>
            {WUDU.map((s, i) => (
              <View key={s.ar} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.primarySoft }}>
                  <Txt weight="bold" color={t.colors.primaryDeep}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt style={{ flex: 1, lineHeight: 24 }}>{tr(s.ar, s.en)}</Txt>
                {i === 0 ? <Droplets size={18} color={t.colors.primary} /> : null}
              </View>
            ))}
          </Card>
          <Chip label={tr('الذكر بعد الوضوء', 'After wudu')} onPress={() => hisn(9)} />
          <Evidence id={UTHMAN_WUDU} full />
        </>
      ) : (
        <>
          <Card padded={false}>
            {SALAH.map((s, i) => (
              <Pressable key={s.ar} disabled={!s.chapter} onPress={() => s.chapter && hisn(s.chapter)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.primarySoft }}>
                  <Txt weight="bold" color={t.colors.primaryDeep}>
                    {i + 1}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ lineHeight: 24 }}>{tr(s.ar, s.en)}</Txt>
                  {s.chapter ? (
                    <Txt variant="caption" color={t.colors.primary}>
                      {tr('ما يُقال فيه', 'What to say')}
                    </Txt>
                  ) : null}
                </View>
                {s.chapter ? <Chevron size={18} color={t.colors.textFaint} /> : null}
              </Pressable>
            ))}
          </Card>
          <Evidence id={PRAY_AS_I} />
        </>
      )}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('الخطوات كما في الأحاديث المذكورة، وفي تفاصيل الأركان والسنن خلاف بين المذاهب؛ فاسأل أهل العلم عما يشكل عليك.', 'The steps follow the hadiths shown; the schools differ on which are pillars and which are sunnah, so ask a scholar about anything unclear.')}
      </Txt>
    </Screen>
  );
}
