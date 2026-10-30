// «مواقيت الصلاة في الطائرة»: enter a flight; each prayer time is found where the aircraft will
// be along its route, with the qibla relative to the aircraft's nose.
import { router } from 'expo-router';
import { Minus, Plane, Plus, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, EmptyState, IconButton, Row, Txt } from '@/components/ui';
import { CityPicker } from '@/features/city-picker';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { flightPrayerTimes, type FlightEvent } from '@/lib/flight';
import { addCivilDays } from '@/lib/hijri';
import type { PlaceLocation } from '@/lib/prayer-times';
import { instantAt } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** Voluntary prayer on the mount, facing wherever it went (Abu Dawud). */
const MOUNT_HADITH = 10644;
/** Jabir: voluntary prayer on his mount wherever it faced; for the obligatory he dismounted (al-Bukhari). */
const FARD_DISMOUNT_HADITH = 10643;
/** ʿImran ibn Husayn: «pray standing; if you cannot, sitting; if you cannot, on your side» (al-Bukhari). */
const ABILITY_HADITH = 10951;

function Stepper({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string }) {
  const { tr } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Txt variant="caption" muted>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton icon={Minus} label={tr('أنقص', 'Less')} size={34} onPress={() => onChange(value - step < min ? max : value - step)} />
        <Txt variant="heading" style={{ minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {format ? format(value) : String(value)}
        </Txt>
        <IconButton icon={Plus} label={tr('زد', 'More')} size={34} onPress={() => onChange(value + step > max ? min : value + step)} />
      </View>
    </View>
  );
}

export default function FlightScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const [from, setFrom] = useState<PlaceLocation | null>(location);
  const [to, setTo] = useState<PlaceLocation | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState(14);
  const [minute, setMinute] = useState(0);
  const [hours, setHours] = useState(5);
  const [minutes, setMinutes] = useState(30);

  const pad = (n: number) => String(n).padStart(2, '0');
  const departure = from ? instantAt(addCivilDays(today, dayOffset), hour, minute, from.timezone) : null;
  const events: FlightEvent[] =
    from && to && departure ? flightPrayerTimes({ from, to, departure, durationMin: hours * 60 + minutes, method: prayer.method, madhab: prayer.madhab }) : [];
  const elapsed = (e: FlightEvent) => {
    const m = Math.round((e.at.getTime() - departure!.getTime()) / 60_000);
    return tr(`بعد ${Math.floor(m / 60)} س ${m % 60} د من الإقلاع`, `${Math.floor(m / 60)} h ${m % 60} min after take-off`);
  };
  const where = (rel: number) => {
    const d = Math.round(Math.abs(rel));
    if (d <= 15) return tr('القبلة أمامك تقريبًا', 'Qibla roughly ahead');
    if (d >= 165) return tr('القبلة خلفك تقريبًا', 'Qibla roughly behind');
    return rel > 0 ? tr(`القبلة على يمينك ${d}° من مقدمة الطائرة`, `Qibla ${d}° to your right of the nose`) : tr(`القبلة على يسارك ${d}° من مقدمة الطائرة`, `Qibla ${d}° to your left of the nose`);
  };

  return (
    <Screen title={tr('الصلاة في الطائرة', 'Prayer on a flight')} subtitle={tr('مواقيت الصلاة واتجاه القبلة على مسار رحلتك', 'Prayer times and qibla along your route')}>
      <Card style={{ gap: 12 }}>
        <CityPicker label={tr('من', 'From')} value={from} onChange={setFrom} />
        <CityPicker label={tr('إلى', 'To')} value={to} onChange={setTo} />
        <Txt variant="caption" muted>
          {tr(`الإقلاع (بتوقيت ${from?.name ?? 'مدينة الإقلاع'})`, `Take-off (${from?.name ?? 'origin'} time)`)}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <Chip key={d} label={d === 0 ? tr('اليوم', 'Today') : d === 1 ? tr('غدًا', 'Tomorrow') : f.weekday(addCivilDays(today, d))} active={dayOffset === d} onPress={() => setDayOffset(d)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stepper label={tr('الساعة', 'Hour')} value={hour} onChange={setHour} min={0} max={23} format={pad} />
          <Stepper label={tr('الدقيقة', 'Minute')} value={minute} onChange={setMinute} min={0} max={55} step={5} format={pad} />
        </View>
        <Txt variant="caption" muted>
          {tr('مدة الرحلة', 'Flight time')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stepper label={tr('ساعات', 'Hours')} value={hours} onChange={setHours} min={0} max={20} />
          <Stepper label={tr('دقائق', 'Minutes')} value={minutes} onChange={setMinutes} min={0} max={55} step={5} />
        </View>
      </Card>

      {!to ? (
        <EmptyState icon={Plane} title={tr('اختر وجهتك', 'Choose your destination')} message={tr('نحسب مكان الطائرة كل دقيقة على أقصر مسار، ومتى تبلغ الشمس موضع كل صلاة.', 'We place the aircraft minute by minute on the shortest route and find when the sun reaches each prayer’s position.')} />
      ) : events.length ? (
        <Card padded={false}>
          {events.map((e, i) => (
            <View key={`${e.id}-${e.at.getTime()}`} style={{ gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt weight="bold" color={e.id === 'sunrise' ? t.colors.textMuted : t.colors.primaryDeep} style={{ flex: 1 }}>
                  {e.id === 'sunrise' ? tr('الشروق', 'Sunrise') : f.prayer(e.id)}
                </Txt>
                <Txt weight="semibold">{f.time(e.at, from!.timezone)}</Txt>
              </View>
              <Txt variant="caption" muted>
                {tr(`${elapsed(e)} · ${f.time(e.at, to.timezone)} بتوقيت ${to.name}`, `${elapsed(e)} · ${f.time(e.at, to.timezone)} ${to.name} time`)}
              </Txt>
              {e.id !== 'sunrise' ? <Txt variant="caption" color={t.colors.primary}>{where(e.relative)}</Txt> : null}
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Txt muted>{tr('لا يدخل وقت صلاة جديدة أثناء هذه الرحلة.', 'No new prayer time begins during this flight.')}</Txt>
        </Card>
      )}

      <Txt variant="caption" muted style={{ lineHeight: 20 }}>
        {tr(
          'الأوقات تقريبية: مسار الطائرة الفعلي وسرعتها قد يختلفان، ويُراعى انخفاض الأفق من ارتفاع الطيران عند الشروق والغروب. واتجاه القبلة نسبةً إلى مقدمة الطائرة على المسار المتوقع. إن رأيت الشمس فهي المرجع.',
          'Times are approximate: the real route and speed may differ; sunrise and sunset allow for the lower horizon at cruising altitude. The qibla is given relative to the nose on the expected route. If you can see the sun, it decides.',
        )}
      </Txt>
      <Row icon={Scale} title={tr('القصر والجمع في السفر', 'Shortening and combining')} subtitle={tr('دليل السفر بأدلته وأقوال العلماء', 'The travel guide, with evidence')} onPress={() => router.push('/travel')} />

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('الصلاة في وسائل النقل', 'Praying on board')}</Txt>
        <Txt style={{ lineHeight: 26 }}>
          {tr(
            'النافلة: تُصلّى في الطائرة والسيارة والقطار إلى حيث اتجهت، كما كان النبي ﷺ يتطوع على راحلته.\nالفريضة: كان ﷺ ينزل لها ويستقبل القبلة. فإن أمكن أداؤها قبل الإقلاع أو بعد الهبوط في وقتها، أو جمعها مع ما قبلها أو بعدها لمن يجمع في السفر، فذاك. وإن خشي خروج وقتها صلّاها في مكانه بحسب استطاعته: قائمًا مستقبل القبلة إن استطاع، وإلا فقاعدًا، لقوله تعالى ﴿فَٱتَّقُوا۟ ٱللَّهَ مَا ٱسْتَطَعْتُمْ﴾ [التغابن: 16].',
            'Voluntary prayer: on a plane, car or train, facing wherever it goes, as the Prophet ﷺ prayed on his mount.\nObligatory prayer: he ﷺ dismounted for it and faced the qibla. If it can be prayed in its time before take-off or after landing, or combined for those who combine when travelling, do so. If its time would run out, pray where you are as you are able — standing towards the qibla if you can, otherwise sitting — “so fear Allah as much as you are able” (64:16).',
          )}
        </Txt>
        <Evidence id={FARD_DISMOUNT_HADITH} full />
        <Evidence id={ABILITY_HADITH} full />
        <Evidence id={MOUNT_HADITH} />
      </Card>
    </Screen>
  );
}
