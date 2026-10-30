// «خطط الصيام»: the six days of Shawwal, ticked off one by one, and the fast of Dawud (a day on, a
// day off) laid out ahead, skipping the days on which fasting is not allowed.
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Chip, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { civilKey, toHijri } from '@/lib/hijri';
import { dawudPlan, shawwalDays } from '@/lib/seasons-extra';
import { useSettings } from '@/store/settings';
import { useFastingStore } from '@/store/user';
import { useTheme } from '@/theme';

const SHAWWAL_HADITH = 65523; // Whoever fasts Ramadan then follows it with six of Shawwal (Muslim)
const DAWUD_HADITH = 4541; // The most beloved fast to Allah is Dawud's (agreed upon)
const FORBIDDEN_HADITH = 65519; // The days of Tashreeq are days of eating and drinking (Muslim)

export default function FastingPlans() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const days = useFastingStore((s) => s.days);
  const mark = useFastingStore((s) => s.mark);
  const [tab, setTab] = useState<'shawwal' | 'dawud'>(toHijri(today, offset).month === 10 ? 'shawwal' : 'dawud');

  const shawwal = shawwalDays(today, offset);
  const fastedInShawwal = shawwal.filter((d) => days[civilKey(d)] === 'fasted').length;
  const plan = dawudPlan(today, 21, offset);

  return (
    <Screen title={tr('خطط الصيام', 'Fasting plans')} subtitle={tr('ست شوال وصيام داود', 'Six of Shawwal and the fast of Dawud')}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={tr('ست من شوال', 'Six of Shawwal')} active={tab === 'shawwal'} onPress={() => setTab('shawwal')} />
        <Chip label={tr('صيام داود', 'The fast of Dawud')} active={tab === 'dawud'} onPress={() => setTab('dawud')} />
      </View>

      {tab === 'shawwal' ? (
        <>
          <Card tone="primary" style={{ gap: 6 }}>
            <Txt variant="title" color="#FFFFFF">
              {tr(`${Math.min(6, fastedInShawwal)} من 6`, `${Math.min(6, fastedInShawwal)} of 6`)}
            </Txt>
            <Txt color="rgba(255,255,255,0.9)">{fastedInShawwal >= 6 ? tr('أتممت الست، تقبّل الله منك', 'You completed the six — may Allah accept') : tr('المس اليوم الذي صمته', 'Tap each day you fasted')}</Txt>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {shawwal.map((d) => {
              const k = civilKey(d);
              const done = days[k] === 'fasted';
              const future = k > civilKey(today);
              return (
                <Pressable
                  key={k}
                  disabled={future}
                  onPress={() => mark(d, done ? null : 'fasted')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done, disabled: future }}
                  style={{ width: '13%', flexGrow: 1, aspectRatio: 0.9, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: done ? t.colors.fill : t.colors.surface, borderWidth: 1, borderColor: k === civilKey(today) ? t.colors.primary : t.colors.border, opacity: future ? 0.45 : 1 }}>
                  {done ? <Check size={14} color="#FFFFFF" /> : null}
                  <Txt variant="caption" weight="semibold" color={done ? '#FFFFFF' : undefined}>
                    {toHijri(d, offset).day}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="caption" muted>
            {shawwal[0] ? tr(`شوال من ${f.civil(shawwal[0])}؛ يبدأ من ثاني أيامه لأن الأول يوم العيد.`, `Shawwal from ${f.civil(shawwal[0])}; from its second day, as the first is Eid.`) : ''}
          </Txt>
          <Evidence id={SHAWWAL_HADITH} full />
        </>
      ) : (
        <>
          <Card padded={false}>
            {plan.map((p, i) => {
              const k = civilKey(p.date);
              const done = days[k] === 'fasted';
              return (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border, backgroundColor: p.fast ? t.colors.primarySoft : 'transparent' }}>
                  <Txt style={{ flex: 1 }}>{`${f.weekday(p.date)} ${f.civil(p.date)}`}</Txt>
                  <Txt variant="caption" weight="semibold" color={p.fast ? t.colors.primaryDeep : t.colors.textMuted}>
                    {p.fast ? tr('صيام', 'Fast') : tr('فطر', 'No fast')}
                  </Txt>
                  {p.fast && k <= civilKey(today) ? <Chip label={done ? tr('صمت ✓', 'Fasted ✓') : tr('صمت', 'Fasted')} active={done} onPress={() => mark(p.date, done ? null : 'fasted')} /> : null}
                </View>
              );
            })}
          </Card>
          <Txt variant="caption" muted style={{ lineHeight: 20 }}>
            {tr('يبدأ من اليوم. وتُترك أيام العيدين والتشريق ويستأنف بعدها، ورمضان صيامه فرض فيتوقف فيه الجدول.', 'It starts today. The two Eids and the days of Tashreeq are skipped and it resumes after them; Ramadan is fasted anyway, so the plan pauses.')}
          </Txt>
          <Evidence id={DAWUD_HADITH} full />
          <Evidence id={FORBIDDEN_HADITH} full />
        </>
      )}
    </Screen>
  );
}
