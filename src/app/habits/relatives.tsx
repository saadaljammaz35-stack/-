// «صلة الرحم»: the relatives to keep in touch with, how often for each, and who is due now. A
// reminder comes in the evening of the day each one is due.
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { Evidence } from '@/features/hadith/evidence';
import { rescheduleNotifications } from '@/features/notifications';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, parseCivilKey } from '@/lib/hijri';
import { relativeDue } from '@/lib/habits';
import { useRelativesStore } from '@/store/user';
import { useTheme } from '@/theme';

const TIES_HADITH = 5372; // Whoever would like his provision enlarged … let him keep ties (agreed upon)
const EVERY = [3, 7, 14, 30];

export default function Relatives() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const relatives = useRelativesStore((s) => s.relatives);
  const add = useRelativesStore((s) => s.add);
  const contacted = useRelativesStore((s) => s.contacted);
  const setEvery = useRelativesStore((s) => s.setEvery);
  const remove = useRelativesStore((s) => s.remove);
  const [name, setName] = useState('');
  const [every, setEveryDraft] = useState(7);

  // Keep the evening reminders in step with the list.
  useEffect(() => {
    rescheduleNotifications().catch(() => undefined);
  }, [relatives]);

  const key = civilKey(today);
  const sorted = [...relatives].sort((a, b) => (relativeDue(a, today) < relativeDue(b, today) ? -1 : 1));
  const label = (n: number) => (n === 3 ? tr('كل 3 أيام', 'Every 3 days') : n === 7 ? tr('أسبوعيًا', 'Weekly') : n === 14 ? tr('كل أسبوعين', 'Fortnightly') : tr('شهريًا', 'Monthly'));

  return (
    <Screen title={tr('صلة الرحم', 'Keeping ties')} subtitle={tr('اتصال، زيارة، أو رسالة', 'A call, a visit or a message')}>
      <Evidence id={TIES_HADITH} full />
      {sorted.map((r) => {
        const due = relativeDue(r, today);
        const isDue = due <= key;
        return (
          <Card key={r.id} style={{ gap: 10, borderWidth: isDue ? 1.5 : 0, borderColor: t.colors.primary }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{r.name}</Txt>
                <Txt variant="caption" muted>
                  {isDue ? tr('حان موعد التواصل', 'Due now') : tr(`الموعد القادم ${f.civil(parseCivilKey(due))}`, `Next ${f.civil(parseCivilKey(due))}`)}
                  {r.last ? tr(` · آخر تواصل ${f.civil(parseCivilKey(r.last))}`, ` · last ${f.civil(parseCivilKey(r.last))}`) : ''}
                </Txt>
              </View>
              <IconButton icon={Trash2} label={tr('حذف', 'Delete')} tone="plain" size={34} onPress={() => remove(r.id)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {EVERY.map((n) => (
                <Chip key={n} label={label(n)} active={r.everyDays === n} onPress={() => setEvery(r.id, n)} />
              ))}
            </View>
            <Button title={r.last === key ? tr('تواصلت اليوم ✓', 'Contacted today ✓') : tr('تواصلت معه', 'I got in touch')} icon={Check} tone={isDue ? 'primary' : 'soft'} onPress={() => contacted(r.id, today)} />
          </Card>
        );
      })}
      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('أضف قريبًا', 'Add a relative')}</Txt>
        <TextInput value={name} onChangeText={setName} maxLength={40} placeholder={tr('مثل: خالي أبو محمد', 'e.g. my uncle')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EVERY.map((n) => (
            <Chip key={n} label={label(n)} active={every === n} onPress={() => setEveryDraft(n)} />
          ))}
        </View>
        <Button
          title={tr('أضف', 'Add')}
          icon={Plus}
          disabled={!name.trim()}
          onPress={() => {
            add(name, every);
            setName('');
          }}
        />
      </Card>
      <Txt variant="caption" muted center>
        {tr('القائمة على جهازك فقط، ويصلك تذكير مساء يوم الموعد.', 'The list stays on your device; a reminder comes in the evening it is due.')}
      </Txt>
    </Screen>
  );
}
