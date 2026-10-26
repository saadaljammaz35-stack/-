import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, Group, IconButton, Row, Segmented, SwitchRow, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toHijri } from '@/lib/hijri';
import { METHODS, PRAYER_IDS, type HighLatitude, type Madhhab } from '@/lib/prayer-times';
import { useToday } from '@/hooks/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

function Stepper({ value, onChange, min = -60, max = 60 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const { tr } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconButton icon={Minus} label={tr('إنقاص', 'Decrease')} size={32} onPress={() => onChange(Math.max(min, value - 1))} />
      <Txt weight="semibold" style={{ minWidth: 34, textAlign: 'center' }}>
        {value > 0 ? `+${value}` : value}
      </Txt>
      <IconButton icon={Plus} label={tr('زيادة', 'Increase')} size={32} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

export default function PrayerSettings() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const prayer = useSettings((s) => s.prayer);
  const setPrayer = useSettings((s) => s.setPrayer);
  const today = useToday();

  return (
    <Screen title={tr('إعدادات المواقيت', 'Prayer settings')}>
      <Txt weight="semibold">{tr('طريقة الحساب', 'Calculation method')}</Txt>
      <Group>
        {METHODS.map((m) => (
          <Row
            key={m.id}
            title={m.name}
            subtitle={m.note}
            chevron={false}
            onPress={() => setPrayer({ method: m.id })}
            right={<View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.colors.primary, backgroundColor: prayer.method === m.id ? t.colors.primary : 'transparent' }} />}
          />
        ))}
      </Group>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('حساب وقت العصر', 'Asr calculation')}</Txt>
        <Segmented<Madhhab>
          value={prayer.madhab}
          onChange={(v) => setPrayer({ madhab: v })}
          options={[
            { value: 'shafi', label: tr('الجمهور (المثل)', 'Standard (1×)') },
            { value: 'hanafi', label: tr('الحنفي (المثلين)', 'Hanafi (2×)') },
          ]}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('خطوط العرض العليا', 'High latitudes')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['auto', tr('تلقائي', 'Auto')],
              ['middleofthenight', tr('منتصف الليل', 'Middle of night')],
              ['seventhofthenight', tr('سُبع الليل', 'Seventh of night')],
              ['twilightangle', tr('زاوية الشفق', 'Twilight angle')],
            ] as [HighLatitude, string][]
          ).map(([v, l]) => (
            <Chip key={v} label={l} active={prayer.highLatitude === v} onPress={() => setPrayer({ highLatitude: v })} />
          ))}
        </View>
      </Card>

      {prayer.method === 'UmmAlQura' ? (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
          <SwitchRow title={tr('العشاء بعد المغرب بساعتين في رمضان', 'Isha +120 min in Ramadan')} subtitle={tr('كما في تقويم أم القرى', 'As in the Umm al-Qura calendar')} value={prayer.ramadanIsha} onChange={(v) => setPrayer({ ramadanIsha: v })} />
        </View>
      ) : null}

      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('تعديل يدوي بالدقائق', 'Manual adjustments (minutes)')}</Txt>
        {PRAYER_IDS.map((id) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt>{f.prayer(id)}</Txt>
            <Stepper value={prayer.adjustments[id]} onChange={(v) => setPrayer({ adjustments: { ...prayer.adjustments, [id]: v } })} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('تعديل التاريخ الهجري', 'Hijri date adjustment')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt muted style={{ flex: 1 }}>
            {f.hijri(toHijri(today, prayer.hijriOffset))}
          </Txt>
          <Stepper value={prayer.hijriOffset} min={-2} max={2} onChange={(v) => setPrayer({ hijriOffset: v })} />
        </View>
        <Txt variant="caption" muted>
          {tr('يعتمد التطبيق تقويم أم القرى؛ عدّل بيوم إذا اختلفت رؤية الهلال في بلدك.', 'Umm al-Qura calendar; adjust by a day if moon sighting differs locally.')}
        </Txt>
      </Card>
    </Screen>
  );
}
