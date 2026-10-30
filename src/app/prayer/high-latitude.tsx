// «البلاد الشمالية»: why Fajr and Isha need an estimate far from the equator in summer, what each
// estimation rule computes, and whether the user's city needs one tonight.
import { router } from 'expo-router';
import { MoonStar, Settings2 } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { useNow } from '@/hooks/time';
import { useI18n } from '@/i18n';
import type { HighLatitude } from '@/lib/prayer-times';
import { lowestSunAltitude } from '@/lib/sun';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** The usual depression for true dawn and the end of twilight. */
const NIGHT_ANGLE = 18;

const RULES: { id: Exclude<HighLatitude, 'auto'>; ar: string; en: string }[] = [
  { id: 'middleofthenight', ar: 'منتصف الليل: لا يتأخر العشاء عن منتصف ما بين الغروب والشروق، ولا يتقدّم الفجر عليه.', en: 'Middle of the night: Isha no later, and Fajr no earlier, than halfway between sunset and sunrise.' },
  { id: 'seventhofthenight', ar: 'سُبع الليل: يُقسم ما بين الغروب والشروق سبعة أجزاء؛ فالعشاء بعد مضي السُّبع الأول على الأكثر، والفجر عند بدء السُّبع الأخير على الأقل.', en: 'Seventh of the night: the night is split in seven; Isha at most after the first seventh, Fajr at least at the start of the last.' },
  { id: 'twilightangle', ar: 'زاوية الشفق: يُؤخذ من الليل جزء بنسبة زاوية الطريقة إلى ٦٠؛ فزاوية ١٨° تعني ٣٠٪ من الليل.', en: 'Twilight angle: a share of the night equal to the method’s angle over 60 — 18° means 30% of the night.' },
];

export default function HighLatitudeGuide() {
  const t = useTheme();
  const { tr } = useI18n();
  const now = useNow(3_600_000);
  const location = useSettings((s) => s.location);
  const rule = useSettings((s) => s.prayer.highLatitude);
  const lowest = location ? lowestSunAltitude(now, location.lat) : null;
  const needs = lowest != null && lowest > -NIGHT_ANGLE;
  const auto = location ? (Math.abs(location.lat) > 48 ? 'seventhofthenight' : 'middleofthenight') : null;

  return (
    <Screen title={tr('البلاد الشمالية والجنوبية', 'High latitudes')} subtitle={tr('حين لا يغيب الشفق في الصيف', 'When twilight never ends in summer')}>
      {location && lowest != null ? (
        <Card tone="primary" style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MoonStar size={20} color={t.colors.highlight} />
            <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
              {location.name}
            </Txt>
          </View>
          <Txt color="rgba(255,255,255,0.92)" style={{ lineHeight: 24 }}>
            {needs
              ? tr(`تنزل الشمس الليلة إلى ${Math.abs(lowest).toFixed(1)}° تحت الأفق فقط، أقل من ${NIGHT_ANGLE}°: لا يغيب الشفق تمامًا، فوقتا الفجر والعشاء يُقدّران بالقاعدة المختارة.`, `Tonight the sun only goes ${Math.abs(lowest).toFixed(1)}° below the horizon, less than ${NIGHT_ANGLE}°: twilight never fully ends, so Fajr and Isha are estimated by the chosen rule.`)
              : tr(`تنزل الشمس الليلة إلى ${Math.abs(lowest).toFixed(1)}° تحت الأفق، فيغيب الشفق ويطلع الفجر بعلامتيهما، ولا حاجة إلى تقدير.`, `Tonight the sun goes ${Math.abs(lowest).toFixed(1)}° below the horizon, so twilight ends and dawn breaks by their signs; no estimate is needed.`)}
          </Txt>
          <Txt variant="caption" color="rgba(255,255,255,0.8)">
            {tr(`خط العرض ${Math.abs(location.lat).toFixed(1)}° ${location.lat >= 0 ? 'شمالًا' : 'جنوبًا'}`, `Latitude ${Math.abs(location.lat).toFixed(1)}° ${location.lat >= 0 ? 'N' : 'S'}`)}
          </Txt>
        </Card>
      ) : null}

      <Txt style={{ lineHeight: 26 }}>
        {tr(
          'يُعرف الفجر بانتشار الضوء في الأفق والعشاء بغياب الشفق، ويحسبهما التطبيق حين تكون الشمس تحت الأفق بزاوية الطريقة المختارة (نحو ١٨°). وفي الصيف بعيدًا عن خط الاستواء قد لا تنزل الشمس إلى تلك الزاوية أبدًا، فيبقى الشفق إلى الصباح، فيُقدَّر الوقتان بإحدى هذه القواعد:',
          'Dawn is known by light spreading on the horizon and Isha by the twilight’s disappearance; the app computes them when the sun is the method’s angle (about 18°) below the horizon. In summer far from the equator the sun may never get that low, so twilight lasts till morning and the two times are estimated by one of these rules:',
        )}
      </Txt>
      <Card padded={false}>
        {RULES.map((r, i) => {
          const active = rule === r.id || (rule === 'auto' && auto === r.id);
          return (
            <View key={r.id} style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border, backgroundColor: active ? t.colors.primarySoft : 'transparent', gap: 4 }}>
              <Txt style={{ lineHeight: 24 }}>{tr(r.ar, r.en)}</Txt>
              {active ? (
                <Txt variant="caption" color={t.colors.primaryDeep} weight="semibold">
                  {rule === 'auto' ? tr('المستخدم الآن (تلقائي)', 'In use now (auto)') : tr('المستخدم الآن', 'In use now')}
                </Txt>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr(
          'الاختيار التلقائي يأخذ «سُبع الليل» فوق خط العرض ٤٨° و«منتصف الليل» دونه. وهذه طرق حسابية للتقدير عند غياب العلامة؛ والمرجع في اختيارها فتوى أهل العلم في بلدك ومساجده.',
          'Auto uses the seventh of the night above 48° and the middle of the night below. These are calculation rules for estimating when the sign is absent; which to follow is for the scholars and mosques of your country to decide.',
        )}
      </Txt>
      <Button title={tr('اختر القاعدة', 'Choose the rule')} icon={Settings2} tone="soft" onPress={() => router.push('/prayer/settings')} />
    </Screen>
  );
}
