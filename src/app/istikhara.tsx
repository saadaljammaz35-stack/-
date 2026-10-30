// «الاستخارة»: how the Prophet ﷺ taught it, its dua, and a private notebook of the matters the user
// sought Allah's choice in — when they prayed and what came of it. Stays on the device.
import { router } from 'expo-router';
import { Check, HandHeart, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { Evidence } from '@/features/hadith/evidence';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useIstikharaStore, type IstikharaEntry } from '@/store/user';
import { useTheme } from '@/theme';

/** Jabir: «كان رسول الله ﷺ يعلّمنا الاستخارة في الأمور كلها» (al-Bukhari). */
const ISTIKHARA_HADITH = 3293;
const ISTIKHARA_CHAPTER = 26;

function Entry({ e }: { e: IstikharaEntry }) {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const tz = useSettings((s) => s.location?.timezone);
  const prayed = useIstikharaStore((s) => s.prayed);
  const setOutcome = useIstikharaStore((s) => s.setOutcome);
  const close = useIstikharaStore((s) => s.close);
  const remove = useIstikharaStore((s) => s.remove);
  const [draft, setDraft] = useState(e.outcome);
  const day = (ms: number) => f.civil(civilDateIn(new Date(ms), tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone));

  return (
    <Card style={{ gap: 10, opacity: e.closedAt ? 0.75 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="semibold">{e.matter}</Txt>
          <Txt variant="caption" muted>
            {tr(`بدأت ${day(e.createdAt)}`, `Started ${day(e.createdAt)}`)}
            {e.prayed.length ? tr(` · صلّيتها ${e.prayed.length} مرة، آخرها ${day(e.prayed[e.prayed.length - 1])}`, ` · prayed ${e.prayed.length}×, last ${day(e.prayed[e.prayed.length - 1])}`) : ''}
          </Txt>
        </View>
        <IconButton
          icon={Trash2}
          label={tr('حذف', 'Delete')}
          tone="plain"
          size={36}
          onPress={async () => {
            if (await confirmAsync(tr('حذف هذا الأمر؟', 'Delete this matter?'), e.matter, tr('حذف', 'Delete'), tr('إلغاء', 'Cancel'))) remove(e.id);
          }}
        />
      </View>
      {e.closedAt ? null : <Button title={tr('صلّيت الاستخارة الآن', 'I prayed istikhara now')} icon={HandHeart} tone="soft" onPress={() => prayed(e.id)} />}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => setOutcome(e.id, draft)}
        multiline
        maxLength={500}
        placeholder={tr('ماذا تيسّر بعدها؟ (لك وحدك)', 'What came of it? (for you alone)')}
        placeholderTextColor={t.colors.textFaint}
        style={[inputStyle(t), { minHeight: 64, textAlignVertical: 'top' }]}
      />
      <Chip label={e.closedAt ? tr('أُغلق — أعده مفتوحًا', 'Closed — reopen') : tr('انتهى هذا الأمر', 'This is settled')} active={Boolean(e.closedAt)} onPress={() => (setOutcome(e.id, draft), close(e.id, !e.closedAt))} />
    </Card>
  );
}

export default function Istikhara() {
  const t = useTheme();
  const { tr } = useI18n();
  const entries = useIstikharaStore((s) => s.entries);
  const add = useIstikharaStore((s) => s.add);
  const [matter, setMatter] = useState('');
  const open = entries.filter((e) => !e.closedAt);
  const closed = entries.filter((e) => e.closedAt);

  return (
    <Screen title={tr('الاستخارة', 'Istikhara')} subtitle={tr('كما علّمها النبي ﷺ، ودفتر لأمورك', 'As the Prophet ﷺ taught it, with a notebook')}>
      <Evidence id={ISTIKHARA_HADITH} full />
      <Button title={tr('دعاء الاستخارة للقراءة', 'The istikhara dua to read')} icon={HandHeart} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${ISTIKHARA_CHAPTER}` } })} />

      <Card style={{ gap: 10 }}>
        <Txt weight="semibold">{tr('أمر تستخير فيه', 'A matter to seek guidance in')}</Txt>
        <TextInput value={matter} onChangeText={setMatter} maxLength={200} placeholder={tr('مثل: السفر للدراسة، أو قبول الوظيفة', 'e.g. moving for study, accepting the job')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
        <Button
          title={tr('أضف إلى دفتري', 'Add to my notebook')}
          icon={Plus}
          disabled={!matter.trim()}
          onPress={() => {
            add(matter);
            setMatter('');
          }}
        />
      </Card>

      {open.map((e) => (
        <Entry key={e.id} e={e} />
      ))}
      {closed.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Check size={16} color={t.colors.textMuted} />
          <Txt variant="caption" muted>
            {tr('أمور انتهت', 'Settled')}
          </Txt>
        </View>
      ) : null}
      {closed.map((e) => (
        <Entry key={e.id} e={e} />
      ))}
      <Txt variant="caption" muted center>
        {tr('الدفتر محفوظ على جهازك فقط.', 'The notebook stays on your device only.')}
      </Txt>
    </Screen>
  );
}
