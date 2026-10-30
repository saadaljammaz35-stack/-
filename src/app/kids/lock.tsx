// «وضع الطفل»: a four-digit PIN keeps the app on the kids area. A parent who forgets it answers
// a multiplication a young child cannot.
import { router } from 'expo-router';
import { Delete, LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Tap, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { useI18n } from '@/i18n';
import { useKidsStore } from '@/store/user';
import { useTheme } from '@/theme';

const LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

const gate = () => ({ a: 12 + Math.floor(Math.random() * 18), b: 13 + Math.floor(Math.random() * 17) });

export default function KidsLock() {
  const t = useTheme();
  const { tr } = useI18n();
  const lockPin = useKidsStore((s) => s.lockPin);
  const setLockPin = useKidsStore((s) => s.setLockPin);
  const locked = lockPin != null;
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ a: number; b: number } | null>(null);
  const [answer, setAnswer] = useState('');

  const unlock = () => {
    setLockPin(null);
    router.replace('/kids');
  };

  const complete = (pin: string) => {
    setEntry('');
    if (locked) {
      if (pin === lockPin) unlock();
      else setError(tr('الرقم غير صحيح.', 'Wrong PIN.'));
    } else if (first == null) {
      setFirst(pin);
      setError(null);
    } else if (pin === first) {
      setLockPin(pin);
      router.replace('/kids');
    } else {
      setFirst(null);
      setError(tr('الرقمان مختلفان، أعد من البداية.', 'The PINs differ — start again.'));
    }
  };

  const press = (key: string) => {
    if (key === 'del') return setEntry((e) => e.slice(0, -1));
    const next = entry + key;
    if (next.length === LENGTH) complete(next);
    else setEntry(next);
  };

  const prompt = locked ? tr('أدخل الرقم السري للخروج من وضع الطفل', 'Enter the PIN to leave child mode') : first == null ? tr('اختر رقمًا سريًا من أربع خانات', 'Choose a four-digit PIN') : tr('أعد إدخال الرقم للتأكيد', 'Enter it again to confirm');

  return (
    <Screen title={tr('وضع الطفل', 'Child mode')}>
      {!locked ? (
        <Txt muted style={{ lineHeight: 22 }}>
          {tr('يبقى التطبيق على قسم «حفظ الصغار» فلا يصل الطفل إلى غيره، ولا يخرج منه إلا بهذا الرقم.', 'The app stays on the kids’ hifz area; the child cannot reach anything else, and only this PIN leaves it.')}
        </Txt>
      ) : null}
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
        <LockKeyhole size={34} color={t.colors.primary} />
        <Txt weight="semibold" center>
          {prompt}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 14, direction: 'ltr' }}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.colors.primary, backgroundColor: i < entry.length ? t.colors.primary : 'transparent' }} />
          ))}
        </View>
        {error ? <Txt color={t.colors.danger}>{error}</Txt> : null}
        <View style={{ width: 264, flexDirection: 'row', flexWrap: 'wrap', gap: 12, direction: 'ltr' }}>
          {KEYS.map((k, i) =>
            k ? (
              <Tap key={i} accessibilityRole="button" accessibilityLabel={k === 'del' ? tr('حذف', 'Delete') : k} onPress={() => press(k)} style={{ width: 80, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
                {k === 'del' ? <Delete size={22} color={t.colors.text} /> : <Txt variant="heading">{k}</Txt>}
              </Tap>
            ) : (
              <View key={i} style={{ width: 80, height: 64 }} />
            ),
          )}
        </View>
      </View>
      {locked ? (
        question ? (
          <Card style={{ gap: 10 }}>
            <Txt weight="semibold" center>
              {tr(`لولي الأمر: كم حاصل ${question.a} × ${question.b}؟`, `For the parent: what is ${question.a} × ${question.b}?`)}
            </Txt>
            <TextInput value={answer} onChangeText={setAnswer} keyboardType="number-pad" maxLength={4} style={[inputStyle(t), { textAlign: 'center' }]} />
            <Button
              title={tr('خروج', 'Leave')}
              disabled={!answer}
              onPress={() => {
                if (Number(answer) === question.a * question.b) unlock();
                else {
                  setAnswer('');
                  setQuestion(gate());
                }
              }}
            />
          </Card>
        ) : (
          <Button title={tr('نسيت الرقم', 'Forgot the PIN')} tone="plain" onPress={() => setQuestion(gate())} />
        )
      ) : null}
    </Screen>
  );
}
