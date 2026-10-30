// «أوقات النهي والضحى»: today's times in which voluntary prayer is forbidden, and the time of Duha,
// each with its hadith.
import { router } from 'expo-router';
import { Ban, MapPin, Sun } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, usePrayerInfo } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { forbiddenNow, prayerWindows, RISE_MINUTES, ZENITH_MINUTES, type ForbiddenId } from '@/lib/prayer-windows';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** HadeethEnc ids. */
const THREE_TIMES = 10604; // ʿUqbah: three times (Muslim)
const AFTER_FAJR_ASR = 3081; // No prayer after Fajr until sunrise, nor after Asr until sunset (agreed upon)
const DUHA_TWO = 4538; // Abu Hurayrah: the two rak‘ahs of Duha (agreed upon)
const DUHA_BEST = 11283; // «صلاة الأوابين حين ترمض الفصال» (Muslim)
const FORGOTTEN = 65088; // «من نسي صلاة فليصلّ إذا ذكرها» (agreed upon)

const LABEL: Record<ForbiddenId, { ar: string; en: string }> = {
  'after-fajr': { ar: 'بعد صلاة الفجر حتى الشروق', en: 'After the Fajr prayer until sunrise' },
  sunrise: { ar: 'من الشروق حتى ترتفع الشمس قيد رمح', en: 'From sunrise until the sun is a spear’s length high' },
  zenith: { ar: 'حين يقوم قائم الظهيرة حتى تزول الشمس', en: 'At the noon standstill until the sun declines' },
  'after-asr': { ar: 'بعد صلاة العصر حتى الغروب', en: 'After the Asr prayer until sunset' },
};

export default function PrayerWindows() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const now = useNow(30_000);
  const info = usePrayerInfo(now);
  const location = useSettings((s) => s.location);

  if (!location || !info) {
    return (
      <Screen title={tr('أوقات النهي والضحى', 'Forbidden times and Duha')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const tz = location.timezone;
  const w = prayerWindows(info.day.times);
  const current = forbiddenNow(now, w.forbidden);
  const inDuha = now >= w.duha.from && now < w.duha.to;
  const span = (a: Date, b: Date) => `${f.time(a, tz)} – ${f.time(b, tz)}`;

  return (
    <Screen title={tr('أوقات النهي والضحى', 'Forbidden times and Duha')} subtitle={tr('لصلاة التطوع، بمواقيت اليوم', 'For voluntary prayer, with today’s times')}>
      <Card tone="primary" style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {current ? <Ban size={22} color={t.colors.highlight} /> : <Sun size={22} color={t.colors.highlight} />}
          <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
            {current ? tr('الآن وقت نهي', 'Now is a forbidden time') : inDuha ? tr('الآن وقت الضحى', 'Now is the time of Duha') : tr('الآن ليس وقت نهي', 'Now is not a forbidden time')}
          </Txt>
        </View>
        <Txt color="rgba(255,255,255,0.9)">
          {current ? tr(`${LABEL[current.id as ForbiddenId].ar}، ينتهي ${f.time(current.to, tz)}`, `${LABEL[current.id as ForbiddenId].en}; ends ${f.time(current.to, tz)}`) : inDuha ? tr(`يمتد إلى ${f.time(w.duha.to, tz)}`, `Until ${f.time(w.duha.to, tz)}`) : ''}
        </Txt>
      </Card>

      <Card padded={false}>
        {w.forbidden.map((x, i) => {
          const active = current?.id === x.id;
          return (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border, backgroundColor: active ? t.colors.primarySoft : 'transparent' }}>
              <Ban size={18} color={active ? t.colors.danger : t.colors.textMuted} />
              <Txt style={{ flex: 1, lineHeight: 22 }}>{tr(LABEL[x.id as ForbiddenId].ar, LABEL[x.id as ForbiddenId].en)}</Txt>
              <Txt variant="caption" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
                {span(x.from, x.to)}
              </Txt>
            </View>
          );
        })}
      </Card>
      <Evidence id={THREE_TIMES} full />
      <Evidence id={AFTER_FAJR_ASR} full />
      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr(
          `يبدأ النهي في الأول والأخير بعد أداء صلاتي الفجر والعصر لا بدخول وقتهما. وارتفاع الشمس «قيد رمح» وقيام الظهيرة لا يُحدَّدان بدقيقة، فقُدِّرا هنا بنحو ${RISE_MINUTES} دقيقة بعد الشروق ونحو ${ZENITH_MINUTES} دقائق قبل الزوال، كما قدّرهما الشيخان ابن باز وابن عثيمين؛ ومن احتاط زاد. واختلف العلماء في الصلاة ذات السبب في هذه الأوقات كتحية المسجد، أما قضاء الفريضة المنسية فيُصلّى متى ذُكر.`,
          `The first and last begin after praying Fajr and Asr, not when their times enter. "A spear's length" and the noon standstill have no exact minute; they are taken here as about ${RISE_MINUTES} minutes after sunrise and about ${ZENITH_MINUTES} minutes before the zenith, as estimated by Ibn Baz and Ibn ʿUthaymin; adding a margin is more cautious. Scholars differ on prayers with a cause, such as greeting the mosque, in these times; a forgotten obligatory prayer is prayed when remembered.`,
        )}
      </Txt>
      <Evidence id={FORGOTTEN} />

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Sun size={20} color={t.colors.gold} />
          <Txt variant="subheading" style={{ flex: 1 }}>
            {tr('صلاة الضحى', 'Duha prayer')}
          </Txt>
          <Txt weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {span(w.duha.from, w.duha.to)}
          </Txt>
        </View>
        <Txt variant="caption" muted>
          {tr('من ارتفاع الشمس إلى قبيل الزوال، وأفضله آخره حين يشتد الحر.', 'From when the sun has risen until shortly before the zenith; best late, when the heat is strong.')}
        </Txt>
        <Evidence id={DUHA_TWO} />
        <Evidence id={DUHA_BEST} full />
      </Card>
    </Screen>
  );
}
