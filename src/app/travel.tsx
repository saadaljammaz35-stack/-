// «دليل السفر»: whether the user is travelling (against their home town), the shortened and
// combined prayers with today's windows, the evidence, and the scholars' positions with their
// madhhabs, without choosing one for the user.
import { router } from 'expo-router';
import { Home, MapPin, Plane, Scale } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Row, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, usePrayerInfo } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { distanceKm } from '@/lib/geo';
import { TRAVEL_KM } from '@/lib/travel';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const QASR_HADITH = 65536; // «صدقة تصدّق الله بها عليكم» (Muslim)
const JAM_HADITH = 5323; // He combined Dhuhr with Asr and Maghrib with Isha when travelling (Bukhari)
const STAY_HADITH = 65538; // Ibn Abbas: he stayed nineteen days shortening (Bukhari)
const TIMES_HADITH = 10596; // «ووقت صلاة العشاء إلى نصف الليل الأوسط» (Muslim)
const TRAVEL_DUA_HADITH = 6003; // The dua of travel (Muslim)
const TRAVEL_CHAPTER = 96;

const POSITIONS: { ar: string; en: string; views: { ar: string; en: string }[] }[] = [
  {
    ar: 'مسافة السفر التي يُقصر فيها',
    en: 'The distance that counts as travel',
    views: [
      { ar: 'المالكية والشافعية والحنابلة: أربعة بُرُد، وتُقدَّر في زماننا بنحو 80 كيلومترًا.', en: 'Maliki, Shafi‘i and Hanbali: four burud, reckoned today at about 80 km.' },
      { ar: 'الحنفية: مسيرة ثلاثة أيام بالسير المعتاد.', en: 'Hanafi: three days of ordinary travel.' },
      { ar: 'وذهب بعض المحققين كابن تيمية إلى أن المرجع ما يعدّه الناس سفرًا في العرف.', en: 'Some, such as Ibn Taymiyyah, hold that it is whatever custom counts as travel.' },
    ],
  },
  {
    ar: 'مدة الإقامة التي ينقطع بها القصر',
    en: 'How long a stay ends the shortening',
    views: [
      { ar: 'المالكية والشافعية: إذا نوى إقامة أربعة أيام غير يومي الدخول والخروج أتمّ.', en: 'Maliki and Shafi‘i: intending to stay four days, besides arrival and departure, means praying in full.' },
      { ar: 'الحنابلة: إذا نوى إقامة أكثر من أربعة أيام (أكثر من عشرين صلاة) أتمّ.', en: 'Hanbali: intending to stay more than four days (over twenty prayers).' },
      { ar: 'الحنفية: خمسة عشر يومًا فأكثر.', en: 'Hanafi: fifteen days or more.' },
      { ar: 'ومن لم ينوِ مدة ولا يدري متى يرجع يقصر حتى يرجع عند الجمهور.', en: 'Whoever cannot tell when the stay will end shortens until leaving, for the majority.' },
    ],
  },
  {
    ar: 'الجمع بين الصلاتين',
    en: 'Combining two prayers',
    views: [
      { ar: 'الجمهور: يجوز للمسافر جمع الظهر مع العصر، والمغرب مع العشاء، تقديمًا أو تأخيرًا.', en: 'The majority: a traveller may combine Dhuhr with Asr and Maghrib with Isha, early or late.' },
      { ar: 'الحنفية: لا جمع إلا في عرفة والمزدلفة في الحج.', en: 'Hanafi: no combining except at Arafah and Muzdalifah in Hajj.' },
    ],
  },
  {
    ar: 'حكم القصر',
    en: 'Is shortening required?',
    views: [
      { ar: 'الجمهور: القصر رخصة وسنة، والإتمام جائز.', en: 'The majority: shortening is a concession and Sunnah; praying in full is valid.' },
      { ar: 'الحنفية: القصر واجب على المسافر.', en: 'Hanafi: shortening is required of the traveller.' },
    ],
  },
];

export default function TravelGuide() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const f = useFormat();
  const location = useSettings((s) => s.location);
  const home = useSettings((s) => s.home);
  const set = useSettings((s) => s.set);
  const now = useNow(60_000);
  const info = usePrayerInfo(now);
  const away = location && home ? distanceKm(home.lat, home.lng, location.lat, location.lng) : 0;
  const travelling = away >= TRAVEL_KM;
  const label = (x: { ar: string; en: string }) => (lang === 'en' ? x.en : x.ar);

  if (!location || !info) {
    return (
      <Screen title={tr('دليل السفر', 'Travel guide')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const { times } = info.day;
  const tz = location.timezone;
  const midnight = info.day.midnight;

  return (
    <Screen title={tr('دليل السفر', 'Travel guide')} subtitle={tr('القصر والجمع بأدلتها وأقوال العلماء', 'Shortening and combining, with evidence and positions')}>
      <Card tone="primary" style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Plane size={22} color={t.colors.highlight} />
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {travelling ? tr(`أنت في ${location.name}، على بعد ${Math.round(away)} كم من ${home?.name}`, `You are in ${location.name}, ${Math.round(away)} km from ${home?.name}`) : tr(`أنت في ${location.name}`, `You are in ${location.name}`)}
          </Txt>
        </View>
        <Txt color="rgba(255,255,255,0.9)" style={{ lineHeight: 24 }}>
          {travelling
            ? tr('هذه مسافة سفر عند جمهور العلماء، فلك القصر والجمع ما دمت مسافرًا.', 'This is a travel distance for most scholars, so you may shorten and combine while travelling.')
            : home
              ? tr(`مدينتك: ${home.name}. حين تبتعد عنها ${TRAVEL_KM} كم فأكثر يذكّرك التطبيق بأحكام السفر.`, `Home: ${home.name}. When you are ${TRAVEL_KM} km or more away, the app shows the travel rulings.`)
              : tr('حدّد مدينتك ليعرف التطبيق متى تكون مسافرًا.', 'Set your home town so the app knows when you travel.')}
        </Txt>
        {home && home.name !== location.name ? <Button title={tr(`اجعل ${location.name} مدينتي`, `Make ${location.name} my home`)} icon={Home} tone="soft" onPress={() => set({ home: location })} /> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="bold" color={t.colors.primaryDeep}>
          {tr('صلاة المسافر اليوم', 'Prayer while travelling today')}
        </Txt>
        <Txt style={{ lineHeight: 24 }}>{tr('الرباعية ركعتان: الظهر والعصر والعشاء. والفجر والمغرب كما هما.', 'Four-rak‘ah prayers become two: Dhuhr, Asr and Isha. Fajr and Maghrib are unchanged.')}</Txt>
        <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
          <Txt weight="semibold">{tr('الظهر مع العصر', 'Dhuhr with Asr')}</Txt>
          <Txt muted>{tr(`جمع تقديم في وقت الظهر من ${f.time(times.dhuhr, tz)}، أو جمع تأخير في وقت العصر من ${f.time(times.asr, tz)} وقبل المغرب ${f.time(times.maghrib, tz)}.`, `Early in Dhuhr's time from ${f.time(times.dhuhr, tz)}, or late in Asr's from ${f.time(times.asr, tz)}, before Maghrib at ${f.time(times.maghrib, tz)}.`)}</Txt>
        </View>
        <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
          <Txt weight="semibold">{tr('المغرب مع العشاء', 'Maghrib with Isha')}</Txt>
          <Txt muted>{tr(`جمع تقديم في وقت المغرب من ${f.time(times.maghrib, tz)}، أو جمع تأخير في وقت العشاء من ${f.time(times.isha, tz)} وقبل نصف الليل ${f.time(midnight, tz)}.`, `Early in Maghrib's time from ${f.time(times.maghrib, tz)}, or late in Isha's from ${f.time(times.isha, tz)}, before midnight at ${f.time(midnight, tz)}.`)}</Txt>
        </View>
      </Card>

      <Evidence id={QASR_HADITH} />
      <Evidence id={JAM_HADITH} />
      <Evidence id={STAY_HADITH} />
      <Evidence id={TIMES_HADITH} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <Scale size={20} color={t.colors.primary} />
        <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep}>
          {tr('أقوال العلماء', 'What the scholars hold')}
        </Txt>
      </View>
      {POSITIONS.map((p) => (
        <Card key={p.en} style={{ gap: 8 }}>
          <Txt weight="semibold">{label(p)}</Txt>
          {p.views.map((v) => (
            <View key={v.en} style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.primary, marginTop: 10 }} />
              <Txt style={{ flex: 1, lineHeight: 24 }}>{label(v)}</Txt>
            </View>
          ))}
        </Card>
      ))}
      <Txt variant="caption" muted center>
        {tr('خلاصة للأقوال المشهورة في المذاهب الأربعة للتعريف بها، لا ترجيح فيها. والمرجع في الفتوى إلى أهل العلم في بلدك.', 'A summary of the well-known positions of the four schools, without preferring one. For a ruling, ask the scholars of your country.')}
      </Txt>
      <Row icon={Plane} title={tr('الصلاة في الطائرة', 'Prayer on a flight')} subtitle={tr('المواقيت والقبلة على مسار رحلتك', 'Times and qibla along your route')} onPress={() => router.push('/flight')} />
      <Row icon={Scale} title={tr('الفتاوى', 'Fatwas')} subtitle={tr('ابحث في فتاوى أهل العلم', 'Search scholars’ fatwas')} onPress={() => router.push('/fatwa')} />

      <Card style={{ gap: 10 }}>
        <Txt weight="bold" color={t.colors.primaryDeep}>
          {tr('دعاء السفر', 'The dua of travel')}
        </Txt>
        <Evidence id={TRAVEL_DUA_HADITH} full />
        <Button title={tr('أذكار السفر كاملة', 'All travel adhkar')} tone="soft" onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${TRAVEL_CHAPTER}` } })} />
      </Card>
    </Screen>
  );
}
