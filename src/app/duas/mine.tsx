// «دفتر دعائي»: the user's own duas, kept to be asked at the times duas are answered (each shown
// with its hadith), and moved to «الحمد لله» once answered.
import { Check, HandHeart, Pencil, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, TextInput, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, Group, IconButton, SwitchRow, Tap, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useTimeZone } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useDuaStore, type MyDua } from '@/store/user';
import { useTheme } from '@/theme';

/** Times of answered dua, each with the hadith that names it. */
const TIMES = [
  { id: 'between', ar: 'بين الأذان والإقامة', en: 'Between adhan and iqama', hadith: 5479 },
  { id: 'sujood', ar: 'في السجود', en: 'In prostration', hadith: 5382 },
  { id: 'night', ar: 'الثلث الأخير من الليل', en: 'The last third of the night', hadith: 10412 },
  { id: 'friday', ar: 'آخر ساعة يوم الجمعة', en: 'The last hour of Friday', hadith: 65755 },
  { id: 'absent', ar: 'لأخيك بظهر الغيب', en: 'For a brother in his absence', hadith: 3219 },
] as const;

type Draft = { id: string | null; text: string; for: string };

export default function MyDuasScreen() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const f = useFormat();
  const tz = useTimeZone();
  const { duas, add, edit, remove, toggleAnswered } = useDuaStore();
  const fridayHour = useSettings((s) => s.notifications.fridayHour);
  const setNotifications = useSettings((s) => s.setNotifications);
  const [time, setTime] = useState<(typeof TIMES)[number]['id']>('between');
  const [draft, setDraft] = useState<Draft | null>(null);

  const pending = duas.filter((d) => !d.answeredAt);
  const answered = duas.filter((d) => d.answeredAt).sort((a, b) => b.answeredAt! - a.answeredAt!);
  const chosen = TIMES.find((x) => x.id === time)!;
  const inputStyle = { borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: lang === 'en' ? 'left' : 'right' } as const;

  const save = () => {
    if (!draft?.text.trim()) return;
    if (draft.id) edit(draft.id, draft.text, draft.for);
    else add(draft.text, draft.for);
    setDraft(null);
  };

  const row = (d: MyDua, i: number) => (
    <View key={d.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
      <Tap
        onPress={() => toggleAnswered(d.id)}
        hitSlop={8}
        accessibilityLabel={d.answeredAt ? tr('أعدها إلى الانتظار', 'Mark as pending') : tr('استُجيبت، الحمد لله', 'Answered, alhamdulillah')}
        style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: t.colors.primary, backgroundColor: d.answeredAt ? t.colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
      >
        {d.answeredAt ? <Check size={16} color="#FFFFFF" /> : null}
      </Tap>
      <Tap onPress={() => setDraft({ id: d.id, text: d.text, for: d.for })} style={{ flex: 1, gap: 2 }}>
        <Txt style={{ lineHeight: 24 }}>{d.text}</Txt>
        <Txt variant="caption" muted>
          {[d.for, d.answeredAt ? tr(`استُجيبت ${f.civil(civilDateIn(new Date(d.answeredAt), tz))}`, `Answered ${f.civil(civilDateIn(new Date(d.answeredAt), tz))}`) : null].filter(Boolean).join(' · ')}
        </Txt>
      </Tap>
      <Pencil size={16} color={t.colors.textFaint} style={{ marginTop: 4 }} />
    </View>
  );

  return (
    <Screen title={tr('دفتر دعائي', 'My duas')} subtitle={tr('اكتب حاجتك وادعُ بها في أوقات الإجابة', 'Write your needs and ask at the times of answer')}>
      <Card style={{ gap: 10 }}>
        <Txt weight="bold" color={t.colors.primaryDeep}>
          {tr('أوقات الإجابة', 'Times of answer')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {TIMES.map((x) => (
            <Chip key={x.id} label={lang === 'en' ? x.en : x.ar} active={x.id === time} onPress={() => setTime(x.id)} />
          ))}
        </View>
        <Evidence key={chosen.hadith} id={chosen.hadith} />
        {time === 'friday' ? <SwitchRow title={tr('ذكّرني قبل المغرب كل جمعة', 'Remind me before Maghrib every Friday')} value={fridayHour.enabled} onChange={(v) => setNotifications({ fridayHour: { enabled: v } })} /> : null}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep} style={{ flex: 1 }}>
          {tr(`أدعو بها (${pending.length})`, `Asking (${pending.length})`)}
        </Txt>
        <IconButton icon={Plus} label={tr('دعاء جديد', 'New dua')} tone="primary" onPress={() => setDraft({ id: null, text: '', for: '' })} />
      </View>
      {pending.length ? (
        <Card padded={false}>{pending.map(row)}</Card>
      ) : (
        <EmptyState icon={HandHeart} title={tr('دفترك فارغ', 'Nothing written yet')} message={tr('اكتب ما تريد أن تسأل الله إياه، لك ولمن تحب، ويعرضه عليك التطبيق بعد كل أذان.', 'Write what you want to ask Allah for, for yourself and those you love; the app shows it after every adhan.')} action={tr('اكتب دعاءً', 'Write a dua')} onAction={() => setDraft({ id: null, text: '', for: '' })} />
      )}

      {answered.length ? (
        <Group title={tr(`الحمد لله (${answered.length})`, `Alhamdulillah (${answered.length})`)}>
          <View>{answered.map(row)}</View>
        </Group>
      ) : null}

      <Txt variant="caption" muted center>
        {tr('دفترك محفوظ على جهازك فقط، ولا يُرسل إلى أي جهة.', 'Your notebook stays on your device and is never sent anywhere.')}
      </Txt>

      <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Txt variant="heading">{draft?.id ? tr('تعديل الدعاء', 'Edit dua') : tr('دعاء جديد', 'New dua')}</Txt>
            <TextInput
              value={draft?.text ?? ''}
              onChangeText={(text) => setDraft((d) => d && { ...d, text })}
              placeholder={tr('اللهم ...', 'O Allah ...')}
              placeholderTextColor={t.colors.textFaint}
              multiline
              autoFocus
              style={[inputStyle, { minHeight: 96, textAlignVertical: 'top' }]}
            />
            <TextInput
              value={draft?.for ?? ''}
              onChangeText={(v) => setDraft((d) => d && { ...d, for: v })}
              placeholder={tr('لمن؟ (اختياري) مثل: لأمي', 'For whom? (optional)')}
              placeholderTextColor={t.colors.textFaint}
              style={inputStyle}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={tr('حفظ', 'Save')} style={{ flex: 1 }} disabled={!draft?.text.trim()} onPress={save} />
              <Button title={tr('إلغاء', 'Cancel')} tone="soft" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            </View>
            {draft?.id ? (
              <Button
                title={tr('حذف', 'Delete')}
                icon={Trash}
                tone="plain"
                onPress={() => {
                  const id = draft.id!;
                  confirmAsync(tr('حذف الدعاء', 'Delete dua'), draft.text, tr('حذف', 'Delete'), tr('إلغاء', 'Cancel')).then((ok) => {
                    if (!ok) return;
                    remove(id);
                    setDraft(null);
                  });
                }}
              />
            ) : null}
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
