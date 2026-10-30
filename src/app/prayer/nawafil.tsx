// «السنن والنوافل»: the regular sunnahs around the obligatory prayers, witr and Duha, each with its
// hadith, and today's log of them.
import { router } from 'expo-router';
import { Sun } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { arabicDays } from '@/lib/arabic';
import { civilKey } from '@/lib/hijri';
import { RATIBA_RAKAHS, rawatibRakahs, RAWATIB_IDS, witrStreak, type RatibaId } from '@/lib/prayer-log';
import { usePrayerLogStore } from '@/store/user';

/** HadeethEnc ids. */
const TWELVE = 65715; // Umm Habibah: twelve rak‘ahs, a house in Paradise (Muslim)
const TEN = 3062; // Ibn ʿUmar: the ten rak‘ahs he memorised (agreed upon)
const FOUR_BEFORE_DHUHR = 11249; // ʿAʾishah: four before Dhuhr and two before Fajr (al-Bukhari)
const FAJR_TWO = 66400; // «ركعتا الفجر خير من الدنيا وما فيها» (Muslim)
const WITR_LAST = 11259; // «اجعلوا آخر صلاتكم وترًا» (agreed upon)
const WITR_COUNTS = 11262; // Witr with seven, five, three or one (Abu Dawud, al-Nasa'i, Ibn Majah)
const WITR_WHEN = 11278; // Whoever fears not waking, let him pray witr early (Muslim)

const LABEL: Record<RatibaId, { ar: string; en: string }> = {
  'r-fajr': { ar: 'ركعتان قبل الفجر', en: 'Two before Fajr' },
  'r-dhuhr-before': { ar: 'أربع قبل الظهر', en: 'Four before Dhuhr' },
  'r-dhuhr-after': { ar: 'ركعتان بعد الظهر', en: 'Two after Dhuhr' },
  'r-maghrib': { ar: 'ركعتان بعد المغرب', en: 'Two after Maghrib' },
  'r-isha': { ar: 'ركعتان بعد العشاء', en: 'Two after Isha' },
};

export default function Nawafil() {
  const { tr } = useI18n();
  const today = useToday();
  const days = usePrayerLogStore((s) => s.days);
  const qada = usePrayerLogStore((s) => s.qada);
  const toggle = usePrayerLogStore((s) => s.toggleNafila);
  const day = days[civilKey(today)];
  const done = rawatibRakahs(day);
  const witr = witrStreak({ days, qada }, today);

  return (
    <Screen title={tr('السنن والنوافل', 'Sunnah prayers')} subtitle={tr('الرواتب والوتر والضحى بأدلتها', 'The regular sunnahs, witr and Duha, with evidence')}>
      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr(`السنن الرواتب اليوم: ${done} من 12 ركعة`, `Regular sunnahs today: ${done} of 12 rak‘ahs`)}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RAWATIB_IDS.map((id) => (
            <Chip key={id} label={tr(LABEL[id].ar, LABEL[id].en)} active={Boolean(day?.nafila?.[id])} onPress={() => toggle(today, id)} />
          ))}
        </View>
        <Evidence id={TWELVE} full />
        <Evidence id={FOUR_BEFORE_DHUHR} full />
        <Evidence id={TEN} />
        <Txt variant="caption" muted style={{ lineHeight: 20 }}>
          {tr(
            `في حديث ابن عمر ركعتان قبل الظهر، وفي حديث عائشة أربع؛ والمجموع مع الأربع ${Object.values(RATIBA_RAKAHS).reduce((a, b) => a + b, 0)} ركعة كما في حديث أم حبيبة.`,
            `Ibn ʿUmar reports two before Dhuhr and ʿAʾishah four; with four the total is ${Object.values(RATIBA_RAKAHS).reduce((a, b) => a + b, 0)}, as in the hadith of Umm Habibah.`,
          )}
        </Txt>
        <Evidence id={FAJR_TWO} full />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('الوتر', 'Witr')}</Txt>
        <Chip label={witr ? tr(`أوترت الليلة · ${arabicDays(witr)} متتالية`, `Prayed witr · ${witr} nights in a row`) : tr('أوترت الليلة', 'I prayed witr')} active={Boolean(day?.nafila?.witr)} onPress={() => toggle(today, 'witr')} />
        <Evidence id={WITR_LAST} full />
        <Evidence id={WITR_COUNTS} full />
        <Evidence id={WITR_WHEN} full />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('الضحى', 'Duha')}</Txt>
        <Chip label={tr('صليت الضحى', 'I prayed Duha')} active={Boolean(day?.nafila?.duha)} onPress={() => toggle(today, 'duha')} />
        <Button title={tr('وقت الضحى وأوقات النهي اليوم', 'Today’s Duha and forbidden times')} icon={Sun} tone="soft" onPress={() => router.push('/prayer/windows')} />
      </Card>
    </Screen>
  );
}
