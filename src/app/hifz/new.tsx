import { router } from 'expo-router';
import { Minus, Play, Plus, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, Txt } from '@/components/ui';
import { getSurahs, type Surah } from '@/data/content';
import { useI18n } from '@/i18n';
import { normalizeArabic } from '@/lib/arabic';
import { useHifzStore } from '@/store/user';
import { useTheme } from '@/theme';

/** Short surahs people usually start with, from the end of the mushaf. */
const STARTERS = [1, 112, 113, 114, 108, 103, 97, 67, 36, 18];

export default function NewHifz() {
  const t = useTheme();
  const { tr } = useI18n();
  const setPlan = useHifzStore((s) => s.setPlan);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Surah | null>(null);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(5);

  useEffect(() => {
    getSurahs().then(setSurahs);
  }, []);

  const list = useMemo(() => {
    const q = normalizeArabic(query.trim()).toLowerCase();
    if (!q) return surahs;
    return surahs.filter((s) => normalizeArabic(s.name).includes(q) || s.nameSimple.toLowerCase().includes(q) || String(s.id) === q);
  }, [surahs, query]);

  const pick = (s: Surah) => {
    setPicked(s);
    setFrom(1);
    setTo(Math.min(s.versesCount, 5));
  };

  const start = () => {
    if (!picked) return;
    setPlan({ surah: picked.id, from, to, next: from });
    router.replace({ pathname: '/hifz/session', params: { mode: 'learn', surah: String(picked.id), from: String(from), to: String(to) } });
  };

  if (picked) {
    const max = picked.versesCount;
    return (
      <Screen title={tr(`سورة ${picked.name}`, picked.nameSimple)} subtitle={tr(`${max} آية`, `${max} verses`)}>
        <Card style={{ gap: 14 }}>
          <Txt weight="semibold">{tr('المقطع', 'Passage')}</Txt>
          <Stepper label={tr('من الآية', 'From verse')} value={from} min={1} max={to} onChange={setFrom} />
          <Stepper label={tr('إلى الآية', 'To verse')} value={to} min={from} max={max} onChange={setTo} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[3, 5, 10].filter((n) => n < max).map((n) => (
              <Chip key={n} label={tr(`${n} آيات`, `${n} verses`)} active={to - from + 1 === n} onPress={() => setTo(Math.min(max, from + n - 1))} />
            ))}
            <Chip label={tr('السورة كاملة', 'Whole surah')} active={from === 1 && to === max} onPress={() => (setFrom(1), setTo(max))} />
          </View>
          <Txt variant="caption" muted>
            {tr('ننصح بخمس آيات أو أقل في الجلسة، مع مراجعة ما سبق كل يوم.', 'Five verses or fewer per session works best, with daily review of what came before.')}
          </Txt>
        </Card>
        <Button title={tr(`ابدأ الحفظ (${to - from + 1} آيات)`, `Start (${to - from + 1} verses)`)} icon={Play} onPress={start} />
        <Button title={tr('سورة أخرى', 'Another surah')} tone="plain" onPress={() => setPicked(null)} />
      </Screen>
    );
  }

  return (
    <Screen title={tr('حفظ مقطع جديد', 'New passage')} subtitle={tr('اختر السورة', 'Choose a surah')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, paddingHorizontal: 14, borderWidth: 1, borderColor: t.colors.border }}>
        <Search size={18} color={t.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tr('ابحث باسم السورة أو رقمها', 'Search by name or number')}
          placeholderTextColor={t.colors.textFaint}
          style={{ flex: 1, paddingVertical: 12, fontFamily: t.fonts.regular, fontSize: 15, color: t.colors.text, textAlign: t.isRTL ? 'right' : 'left' }}
        />
      </View>
      {!query ? (
        <View style={{ gap: 8 }}>
          <Txt variant="caption" muted>
            {tr('للبداية', 'Good places to start')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STARTERS.map((id) => surahs[id - 1]).filter(Boolean).map((s) => (
              <Chip key={s.id} label={tr(s.name, s.nameSimple)} onPress={() => pick(s)} />
            ))}
          </View>
        </View>
      ) : null}
      <Card padded={false}>
        {list.map((s, i) => (
          <Pressable
            key={s.id}
            onPress={() => pick(s)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.colors.border, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="caption" weight="semibold" color={t.colors.primaryDeep}>
                {s.id}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="medium">{tr(`سورة ${s.name}`, s.nameSimple)}</Txt>
              <Txt variant="caption" muted>
                {tr(`${s.versesCount} آية`, `${s.versesCount} verses`)}
              </Txt>
            </View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { tr } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <IconButton icon={Minus} label={tr('أقل', 'Less')} size={38} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} />
      <Txt variant="heading" weight="bold" style={{ minWidth: 44, textAlign: 'center' }}>
        {value}
      </Txt>
      <IconButton icon={Plus} label={tr('أكثر', 'More')} size={38} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}
