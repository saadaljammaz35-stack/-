// «عاداتي»: good habits ticked day by day, with the last week and a streak for each; and the tools
// around the day: keeping ties, the night's self-review, sleep and phone-free time.
import { router } from 'expo-router';
import { Check, HeartHandshake, Moon, NotebookPen, Plus, SmartphoneNfc, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Group, IconButton, Row, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { arabicDays } from '@/lib/arabic';
import { habitStreak, lastSevenDays, relativesDue } from '@/lib/habits';
import { civilKey, civilWeekday } from '@/lib/hijri';
import { useHabitsStore, useRelativesStore } from '@/store/user';
import { useTheme } from '@/theme';

/** «كل سلامى من الناس عليه صدقة… والكلمة الطيبة صدقة» (agreed upon). */
const EVERY_JOINT = 4568;

export default function Habits() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const habits = useHabitsStore((s) => s.habits);
  const toggle = useHabitsStore((s) => s.toggle);
  const add = useHabitsStore((s) => s.add);
  const remove = useHabitsStore((s) => s.remove);
  const due = useRelativesStore((s) => relativesDue(s.relatives, today).length);
  const [name, setName] = useState('');

  return (
    <Screen title={tr('عاداتي', 'My habits')} subtitle={tr('أعمال صغيرة تداوم عليها', 'Small deeds, kept up')}>
      {habits.map((h) => {
        const done = h.days.includes(civilKey(today));
        const run = habitStreak(h.days, today);
        return (
          <Card key={h.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={() => toggle(h.id, today)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={tr(h.ar, h.en)}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? t.colors.fill : t.colors.surfaceAlt, borderWidth: done ? 0 : 1.5, borderColor: t.colors.border }}>
                {done ? <Check size={18} color="#FFFFFF" /> : null}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold">{tr(h.ar, h.en)}</Txt>
                <Txt variant="caption" muted>
                  {run ? tr(`${arabicDays(run)} متتالية`, `${run} days in a row`) : tr('ابدأ اليوم', 'Start today')}
                </Txt>
              </View>
              {h.custom ? (
                <IconButton
                  icon={Trash2}
                  label={tr('حذف', 'Delete')}
                  tone="plain"
                  size={34}
                  onPress={async () => {
                    if (await confirmAsync(tr('حذف العادة؟', 'Delete the habit?'), tr(h.ar, h.en), tr('حذف', 'Delete'), tr('إلغاء', 'Cancel'))) remove(h.id);
                  }}
                />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {lastSevenDays(h.days, today).map((d) => (
                <View key={civilKey(d.date)} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: d.done ? t.colors.primary : t.colors.surfaceAlt }} />
                  <Txt variant="label" muted>
                    {f.weekdayShort(civilWeekday(d.date))}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
        );
      })}
      <Card style={{ gap: 10 }}>
        <TextInput value={name} onChangeText={setName} maxLength={40} placeholder={tr('عادة جديدة، مثل: سقيا الماء', 'A new habit')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        <Button
          title={tr('أضف', 'Add')}
          icon={Plus}
          tone="soft"
          disabled={!name.trim()}
          onPress={() => {
            add(name);
            setName('');
          }}
        />
      </Card>
      <Group>
        <Row icon={HeartHandshake} title={tr('صلة الرحم', 'Keeping ties')} subtitle={due ? tr(`${due} حان التواصل معهم`, `${due} due`) : tr('أقاربك وموعد التواصل مع كل منهم', 'Your relatives and when to call each')} onPress={() => router.push('/habits/relatives')} />
        <Row icon={NotebookPen} title={tr('محاسبة النفس', 'A look back at the day')} subtitle={tr('ثلاثة أسئلة قبل النوم', 'Three questions before sleep')} onPress={() => router.push('/habits/journal')} />
        <Row icon={Moon} title={tr('متى أنام لأصحو للفجر؟', 'When to sleep to wake for Fajr')} onPress={() => router.push('/habits/sleep')} />
        <Row icon={SmartphoneNfc} title={tr('وقت بلا جوال', 'Phone-free time')} onPress={() => router.push('/habits/phone-free')} />
      </Group>
      <Evidence id={EVERY_JOINT} />
    </Screen>
  );
}
