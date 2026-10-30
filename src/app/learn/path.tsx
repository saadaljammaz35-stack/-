// «مسار التعلّم»: the pillars of faith, then character, manners, supplication and heart-softeners —
// each a step of hadiths from HadeethEnc, read in order, with progress kept.
import { router } from 'expo-router';
import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, ProgressBar, Txt } from '@/components/ui';
import { getEncByCategory, type EncHadith } from '@/data/content';
import { useI18n } from '@/i18n';
import { useLearnStore } from '@/store/user';
import { useTheme } from '@/theme';

/** HadeethEnc categories, in the order of the path. */
const STEPS: { id: number; ar: string; en: string }[] = [
  { id: 59, ar: 'الإيمان بالله', en: 'Faith in Allah' },
  { id: 60, ar: 'الإيمان بالملائكة', en: 'The angels' },
  { id: 61, ar: 'الإيمان بالكتب', en: 'The books' },
  { id: 62, ar: 'الإيمان بالرسل', en: 'The messengers' },
  { id: 63, ar: 'الإيمان باليوم الآخر', en: 'The Last Day' },
  { id: 64, ar: 'الإيمان بالقضاء والقدر', en: 'Divine decree' },
  { id: 266, ar: 'الأخلاق', en: 'Character' },
  { id: 267, ar: 'الآداب الشرعية', en: 'Manners' },
  { id: 268, ar: 'الأدعية والأذكار', en: 'Supplication and dhikr' },
  { id: 269, ar: 'الرقائق والمواعظ', en: 'Softening the heart' },
];

export default function LearningPath() {
  const t = useTheme();
  const { tr } = useI18n();
  const read = useLearnStore((s) => s.read);
  const markRead = useLearnStore((s) => s.markRead);
  const [lists, setLists] = useState<Record<number, EncHadith[]>>({});
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(STEPS.map((s) => getEncByCategory(s.id, 60).then((l) => [s.id, l] as const))).then((entries) => alive && setLists(Object.fromEntries(entries)));
    return () => {
      alive = false;
    };
  }, []);

  const short = (l: EncHadith[] | undefined) => (l ?? []).filter((h) => h.text.length < 1400);
  const all = STEPS.flatMap((s) => short(lists[s.id]));
  const done = all.filter((h) => read.includes(h.id)).length;

  return (
    <Screen title={tr('مسار التعلّم', 'Learning path')} subtitle={tr(`قرأت ${done} من ${all.length} حديثًا`, `${done} of ${all.length} read`)}>
      <ProgressBar value={all.length ? done / all.length : 0} />
      {STEPS.map((s, i) => {
        const list = short(lists[s.id]);
        const n = list.filter((h) => read.includes(h.id)).length;
        const complete = list.length > 0 && n === list.length;
        return (
          <Card key={s.id} padded={false}>
            <Pressable onPress={() => setOpen(open === s.id ? null : s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: complete ? t.colors.fill : t.colors.primarySoft }}>
                {complete ? <Check size={16} color="#FFFFFF" /> : <Txt weight="bold" color={t.colors.primaryDeep}>{i + 1}</Txt>}
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{tr(s.ar, s.en)}</Txt>
                <Txt variant="caption" muted>
                  {tr(`${n} من ${list.length}`, `${n} of ${list.length}`)}
                </Txt>
              </View>
              <ChevronDown size={18} color={t.colors.textFaint} style={{ transform: [{ rotate: open === s.id ? '180deg' : '0deg' }] }} />
            </Pressable>
            {open === s.id
              ? list.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => {
                      markRead(h.id);
                      router.push({ pathname: '/hadith/enc/[id]', params: { id: String(h.id) } });
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: t.colors.border }}>
                    {read.includes(h.id) ? <Check size={16} color={t.colors.success} /> : <View style={{ width: 16 }} />}
                    <Txt style={{ flex: 1 }} numberOfLines={2}>
                      {h.title}
                    </Txt>
                  </Pressable>
                ))
              : null}
          </Card>
        );
      })}
      <Txt variant="caption" muted center>
        {tr('الأحاديث وتصنيفها من موسوعة الأحاديث النبوية (HadeethEnc.com).', 'Hadiths and their categories from HadeethEnc.com.')}
      </Txt>
    </Screen>
  );
}
