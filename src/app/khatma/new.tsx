import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Segmented, SwitchRow, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, formatCivil } from '@/lib/hijri';
import { PRESET_DAYS, schedule, TOTAL_PAGES, totalDays, type KhatmaPlan } from '@/lib/khatma';
import { useKhatmaStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function NewKhatma() {
  const t = useTheme();
  const { tr } = useI18n();
  const fmt = useFormat();
  const today = useToday();
  const add = useKhatmaStore((s) => s.add);
  const count = useKhatmaStore((s) => s.khatmas.length);
  const [name, setName] = useState(tr(`الختمة ${count + 1}`, `Khatma ${count + 1}`));
  const [kind, setKind] = useState<KhatmaPlan['kind']>('days');
  const [days, setDays] = useState(30);
  const [pages, setPages] = useState(20);
  const [reminder, setReminder] = useState(true);
  const [hour, setHour] = useState(20);

  const plan: KhatmaPlan = kind === 'days' ? { kind: 'days', days } : { kind: 'pages', pagesPerDay: pages };
  const preview = useMemo(() => schedule({ plan, startDate: civilKey(today), pausedDays: 0 }), [kind, days, pages, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const perDay = Math.ceil(TOTAL_PAGES / totalDays(plan));

  const prayerPreset = days === 60 && kind === 'days' && name === tr('ختمة الصلاة', 'Prayer khatma');

  const create = () => {
    const id = add({ name: name.trim() || tr('ختمة', 'Khatma'), plan, start: today, reminder: { enabled: reminder, hour, minute: 0 } });
    router.replace({ pathname: '/khatma/[id]', params: { id } });
  };

  return (
    <Screen title={tr('ختمة جديدة', 'New khatma')}>
      <Card
        tone={prayerPreset ? 'primary' : 'soft'}
        onPress={() => {
          setName(tr('ختمة الصلاة', 'Prayer khatma'));
          setKind('days');
          setDays(60);
        }}
        style={{ gap: 4 }}>
        <Txt weight="semibold" color={prayerPreset ? '#FFFFFF' : undefined}>
          {tr('ختمة في صلاتك', 'A khatma in your prayers')}
        </Txt>
        <Txt variant="caption" color={prayerPreset ? 'rgba(255,255,255,0.9)' : undefined} muted={!prayerPreset} style={{ lineHeight: 20 }}>
          {tr('تختم القرآن قراءةً في صلواتك خلال شهرين: نحو عشر صفحات في اليوم، أي صفحتين في كل صلاة من الخمس، أو تجعلها في السنن وقيام الليل.', 'Finish the Quran within your prayers in two months: about ten pages a day — two in each of the five prayers, or in the sunnahs and night prayer.')}
        </Txt>
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight="semibold">{tr('اسم الختمة', 'Name')}</Txt>
        <TextInput value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }} />
      </Card>
      <Segmented<KhatmaPlan['kind']>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'days', label: tr('حسب المدة', 'By duration') },
          { value: 'pages', label: tr('حسب الصفحات اليومية', 'By pages per day') },
        ]}
      />
      {kind === 'days' ? (
        <Card style={{ gap: 12 }}>
          <Txt weight="semibold">{tr('مدة الختمة', 'Duration')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_DAYS.map((d) => (
              <Chip key={d} label={tr(`${d} يومًا`, `${d} days`)} active={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt muted>{tr('مدة مخصصة', 'Custom')}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconButton icon={Minus} label={tr('إنقاص', 'Decrease')} size={34} onPress={() => setDays((d) => Math.max(1, d - 1))} />
              <Txt weight="bold" style={{ minWidth: 40, textAlign: 'center' }}>
                {days}
              </Txt>
              <IconButton icon={Plus} label={tr('زيادة', 'Increase')} size={34} onPress={() => setDays((d) => Math.min(365, d + 1))} />
            </View>
          </View>
        </Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <Txt weight="semibold">{tr('عدد الصفحات يوميًا', 'Pages per day')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[5, 10, 20, 30, 40].map((p) => (
              <Chip key={p} label={String(p)} active={pages === p} onPress={() => setPages(p)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <IconButton icon={Minus} label={tr('إنقاص', 'Decrease')} size={34} onPress={() => setPages((p) => Math.max(1, p - 1))} />
            <Txt weight="bold" style={{ minWidth: 40, textAlign: 'center' }}>
              {pages}
            </Txt>
            <IconButton icon={Plus} label={tr('زيادة', 'Increase')} size={34} onPress={() => setPages((p) => Math.min(604, p + 1))} />
          </View>
        </Card>
      )}
      <Card tone="soft" style={{ gap: 4 }}>
        <Txt weight="semibold" color={t.colors.primaryDeep}>
          {tr(`الورد اليومي نحو ${perDay} صفحة لمدة ${preview.length} يومًا`, `About ${perDay} pages a day for ${preview.length} days`)}
        </Txt>
        <Txt variant="caption" muted>
          {tr(`تبدأ اليوم وتنتهي ${formatCivil(preview[preview.length - 1].date)}`, `Starts today, ends ${fmt.civil(preview[preview.length - 1].date)}`)}
        </Txt>
      </Card>
      <Card style={{ gap: 8, padding: 0 }}>
        <SwitchRow title={tr('تذكير يومي بالورد', 'Daily reminder')} value={reminder} onChange={setReminder} />
        {reminder ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
            {[5, 7, 13, 17, 20, 22].map((h) => (
              <Chip key={h} label={`${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'ص' : 'م'}`} active={hour === h} onPress={() => setHour(h)} />
            ))}
          </View>
        ) : null}
      </Card>
      <Button title={tr('بدء الختمة', 'Start')} onPress={create} />
    </Screen>
  );
}
