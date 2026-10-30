// «محاسبة النفس»: three questions before sleep — what good was done today, what to ask forgiveness
// for, and what to do better tomorrow. Private, on the device.
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, SwitchRow, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, parseCivilKey } from '@/lib/hijri';
import { useSettings } from '@/store/settings';
import { useJournalStore, type JournalEntry } from '@/store/user';
import { useTheme } from '@/theme';

const QUESTIONS: { key: keyof JournalEntry; ar: string; en: string }[] = [
  { key: 'good', ar: 'ماذا قدّمت اليوم من خير؟', en: 'What good did I do today?' },
  { key: 'regret', ar: 'ماذا أستغفر الله منه؟', en: 'What do I ask Allah’s forgiveness for?' },
  { key: 'tomorrow', ar: 'ماذا أُصلح غدًا؟', en: 'What will I do better tomorrow?' },
];

export default function Journal() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const entries = useJournalStore((s) => s.entries);
  const save = useJournalStore((s) => s.save);
  const n = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);
  const [draft, setDraft] = useState<JournalEntry>(() => entries[civilKey(today)] ?? { good: '', regret: '', tomorrow: '' });
  const [saved, setSaved] = useState(false);
  const past = Object.keys(entries)
    .filter((k) => k !== civilKey(today))
    .sort()
    .reverse()
    .slice(0, 14);

  return (
    <Screen title={tr('محاسبة النفس', 'A look back at the day')} subtitle={tr('دقيقتان قبل النوم، لك وحدك', 'Two minutes before sleep, for you alone')}>
      <Card tone="soft">
        <Txt style={{ fontFamily: t.fonts.reading, lineHeight: 32 }} center>
          {'﴿يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ ٱللَّهَ وَلْتَنظُرْ نَفْسٌ مَّا قَدَّمَتْ لِغَدٍ﴾ [الحشر: 18]'}
        </Txt>
      </Card>
      {QUESTIONS.map((q) => (
        <View key={q.key} style={{ gap: 6 }}>
          <Txt weight="semibold">{tr(q.ar, q.en)}</Txt>
          <TextInput
            value={draft[q.key]}
            onChangeText={(x) => (setDraft((d) => ({ ...d, [q.key]: x })), setSaved(false))}
            multiline
            maxLength={600}
            placeholderTextColor={t.colors.textFaint}
            style={[inputStyle(t), { minHeight: 70, textAlignVertical: 'top' }]}
          />
        </View>
      ))}
      <Button title={saved ? tr('حُفظ ✓', 'Saved ✓') : tr('احفظ', 'Save')} onPress={() => (save(today, draft), setSaved(true))} />
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <SwitchRow title={tr('ذكّرني كل ليلة', 'Remind me every night')} subtitle={tr(`الساعة ${n.journal?.at.hour ?? 22}:00`, `At ${n.journal?.at.hour ?? 22}:00`)} value={!!n.journal?.enabled} onChange={(v) => setNotifications({ journal: { enabled: v, at: n.journal?.at ?? { hour: 22, minute: 0 } } })} />
      </View>
      {past.length ? (
        <Card padded={false}>
          {past.map((k, i) => (
            <View key={k} style={{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
              <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>
                {`${f.weekday(parseCivilKey(k))} ${f.civil(parseCivilKey(k))}`}
              </Txt>
              {QUESTIONS.map((q) => (entries[k][q.key] ? <Txt key={q.key} variant="caption">{`${tr(q.ar, q.en)} ${entries[k][q.key]}`}</Txt> : null))}
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
