// «سنن الجمعة»: the day's sunnahs with the hadith for each — ghusl and perfume, going early,
// as-Sajdah and al-Insan in Fajr — and their reminders.
import { router } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Group, SwitchRow, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { Evidence } from '@/features/hadith/evidence';
import { useMushafNav } from '@/features/mushaf/nav';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';

/** HadeethEnc ids. */
const GHUSL_WAJIB = 10036;
const WUDU_SUFFICES = 10035;
const GOING_EARLY = 5393;
const FAJR_SURAHS = 5320;

export default function Friday() {
  const { tr } = useI18n();
  const n = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);
  const read = (surah: number) => {
    const s = surahs[surah - 1];
    if (!s) return;
    useMushafNav.getState().go(s.pageStart);
    router.push({ pathname: '/mushaf', params: { page: String(s.pageStart) } });
  };

  return (
    <Screen title={tr('سنن الجمعة', 'Friday sunnahs')} subtitle={tr('بأحاديثها من الصحيح', 'With their hadith')}>
      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('الغسل والطيب والسواك', 'Ghusl, perfume and siwak')}</Txt>
        <Evidence id={GHUSL_WAJIB} full />
        <Evidence id={WUDU_SUFFICES} full />
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr(
            'اختلف العلماء في حكم غسل الجمعة: فالجمهور على أنه سنة مؤكدة، جمعًا بين الحديثين، وذهب بعضهم إلى وجوبه أخذًا بظاهر الحديث الأول. ينظر: «المغني» لابن قدامة، كتاب الجمعة.',
            'Scholars differ on Friday ghusl: most hold it is a strongly recommended sunnah, reconciling the two hadiths; some hold it obligatory by the apparent wording of the first. See Ibn Qudamah, al-Mughni, Book of Jumuʿah.',
          )}
        </Txt>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('التبكير إلى الجمعة', 'Going early')}</Txt>
        <Evidence id={GOING_EARLY} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('السجدة والإنسان في فجر الجمعة', 'As-Sajdah and al-Insan at Fajr')}</Txt>
        <Evidence id={FAJR_SURAHS} full />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={tr('السجدة', 'As-Sajdah')} icon={BookOpen} tone="soft" style={{ flex: 1 }} onPress={() => read(32)} />
          <Button title={tr('الإنسان', 'Al-Insan')} icon={BookOpen} tone="soft" style={{ flex: 1 }} onPress={() => read(76)} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('سورة الكهف', 'Surat al-Kahf')}</Txt>
        <Button title={tr('اقرأ سورة الكهف', 'Read al-Kahf')} icon={BookOpen} tone="soft" onPress={() => read(18)} />
      </Card>

      <Group title={tr('التذكير', 'Reminders')}>
        <SwitchRow title={tr('قبل فجر الجمعة', 'Before Friday Fajr')} subtitle={tr('بنصف ساعة: السجدة والإنسان', 'Half an hour before: as-Sajdah and al-Insan')} value={!!n.fridayFajr?.enabled} onChange={(v) => setNotifications({ fridayFajr: { enabled: v } })} />
        <SwitchRow title={tr('صباح الجمعة', 'Friday morning')} subtitle={tr('الغسل والطيب والتبكير', 'Ghusl, perfume and going early')} value={!!n.fridaySunnah?.enabled} onChange={(v) => setNotifications({ fridaySunnah: { enabled: v } })} />
        <SwitchRow title={tr('سورة الكهف', 'Surat al-Kahf')} value={n.fridayKahf.enabled} onChange={(v) => setNotifications({ fridayKahf: { ...n.fridayKahf, enabled: v } })} />
        <SwitchRow title={tr('آخر ساعة من الجمعة', 'The last hour of Friday')} subtitle={tr('قبل المغرب بساعة', 'An hour before Maghrib')} value={!!n.fridayHour?.enabled} onChange={(v) => setNotifications({ fridayHour: { enabled: v } })} />
      </Group>
    </Screen>
  );
}
