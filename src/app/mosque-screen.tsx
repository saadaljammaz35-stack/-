// «شاشة المسجد»: a full-screen board for a mosque's TV or tablet — the time, the date, each prayer
// with its adhan and iqama, a countdown to the next adhan or iqama, and the ayah and hadith of the day.
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Pencil, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, StatusBar, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Countdown } from '@/components/countdown';
import { Button, Card, IconButton, Txt } from '@/components/ui';
import { getDailyAyah, getDailyHadith } from '@/data/content';
import { useNow, usePrayerInfo, useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { betweenState } from '@/lib/between';
import { toHijri } from '@/lib/hijri';
import type { FardId } from '@/lib/prayer-log';
import { PRAYER_IDS } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const BG = '#0D1A13';
const LINE = 'rgba(255,255,255,0.08)';
const GOLD = '#E9C46A';

export default function MosqueScreen() {
  useKeepAwake();
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  // Sized to fit: a phone in portrait, or a tablet or TV in landscape.
  const scale = wide ? Math.min(width / 900, height / 520) : Math.min(width / 400, height / 860);
  const now = useNow(1000);
  const today = useToday(now);
  const info = usePrayerInfo(now);
  const location = useSettings((s) => s.location);
  const iqama = useSettings((s) => s.iqama);
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const name = useSettings((s) => s.mosqueName);
  const set = useSettings((s) => s.set);
  const [editing, setEditing] = useState<string | null>(null);
  const [texts, setTexts] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    Promise.all([getDailyAyah(today), getDailyHadith(today)]).then(([a, h]) => setTexts([`${a.text}\n${a.reference ?? ''}`, `${h.text}\n${h.attribution.split('\n')[0]}`]));
  }, [today]);
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => s + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!location || !info) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Button title={tr('حدّد موقع المسجد أولًا', 'Set the mosque’s location first')} onPress={() => router.push('/location')} />
      </View>
    );
  }
  const tz = location.timezone;
  const state = betweenState(now, info.next.previous ? { id: info.next.previous.id as FardId, at: info.next.previous.at } : null, { id: info.next.id as FardId, at: info.next.at }, iqama);
  const friday = info.day.isFriday;
  const big = (n: number) => Math.round(n * scale);

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 16 }}>
      <StatusBar hidden />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon={X} label={tr('خروج', 'Exit')} tone="plain" color="rgba(255,255,255,0.35)" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt color="#FFFFFF" weight="bold" style={{ fontSize: big(20), lineHeight: big(30) }} onLongPress={() => setEditing(name)}>
            {name || tr('مسجدنا', 'Our mosque')}
          </Txt>
          <Txt color="rgba(255,255,255,0.7)" style={{ fontSize: big(12), lineHeight: big(18) }}>{`${f.weekday(today)} · ${f.hijri(toHijri(today, offset))} · ${f.civil(today)}`}</Txt>
        </View>
        <IconButton icon={Pencil} label={tr('اسم المسجد', 'Mosque name')} tone="plain" color="rgba(255,255,255,0.35)" onPress={() => setEditing(name)} />
      </View>

      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: 14, marginTop: 10 }}>
        <View style={[{ alignItems: 'center', justifyContent: 'center', gap: 6 }, wide ? { flex: 1.1 } : null]}>
          <Txt color="#FFFFFF" style={{ fontSize: big(64), lineHeight: big(80), fontVariant: ['tabular-nums'] }}>
            {f.time(now, tz)}
          </Txt>
          <Txt color={GOLD} style={{ fontSize: big(16), lineHeight: big(24) }}>
            {state.phase === 'between' ? tr(`إقامة صلاة ${f.prayer(state.prayer, friday && state.prayer === 'dhuhr')} بعد`, `Iqama of ${f.prayer(state.prayer)} in`) : tr(`أذان ${f.prayer(state.prayer, friday && state.prayer === 'dhuhr')} بعد`, `${f.prayer(state.prayer)} adhan in`)}
          </Txt>
          <Countdown target={(state.phase === 'between' ? state.iqamaAt : state.adhanAt).getTime()} digits={useSettings.getState().digits} color={GOLD} style={{ fontSize: big(40), lineHeight: big(52), fontVariant: ['tabular-nums'] }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: LINE, overflow: 'hidden' }}>
          {PRAYER_IDS.map((id, i) => {
            const at = info.day.times[id];
            const isNext = id === state.prayer;
            const fard = id !== 'sunrise';
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: big(7), borderTopWidth: i ? 1 : 0, borderColor: LINE, backgroundColor: isNext ? 'rgba(233,196,106,0.14)' : 'transparent' }}>
                <Txt color={isNext ? GOLD : '#FFFFFF'} weight="semibold" style={{ flex: 1, fontSize: big(17), lineHeight: big(26) }}>
                  {f.prayer(id, friday && id === 'dhuhr')}
                </Txt>
                <Txt color="#FFFFFF" style={{ width: big(86), textAlign: 'center', fontSize: big(17), lineHeight: big(26), fontVariant: ['tabular-nums'] }}>
                  {f.time(at, tz)}
                </Txt>
                <Txt color="rgba(255,255,255,0.65)" style={{ width: big(86), textAlign: 'center', fontSize: big(15), lineHeight: big(24), fontVariant: ['tabular-nums'] }}>
                  {fard ? f.time(new Date(at.getTime() + iqama[id as FardId] * 60_000), tz) : '—'}
                </Txt>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderColor: LINE }}>
            <View style={{ flex: 1 }} />
            <Txt color="rgba(255,255,255,0.45)" style={{ width: big(86), textAlign: 'center', fontSize: big(11) }}>
              {tr('الأذان', 'Adhan')}
            </Txt>
            <Txt color="rgba(255,255,255,0.45)" style={{ width: big(86), textAlign: 'center', fontSize: big(11) }}>
              {tr('الإقامة', 'Iqama')}
            </Txt>
          </View>
        </View>
      </View>

      {texts.length ? (
        <Txt color="rgba(255,255,255,0.85)" center numberOfLines={3} style={{ fontFamily: t.fonts.reading, fontSize: big(15), lineHeight: big(28), marginTop: 10 }}>
          {texts[slide % texts.length]}
        </Txt>
      ) : null}

      <Modal visible={editing != null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Txt variant="heading">{tr('اسم المسجد', 'Mosque name')}</Txt>
            <TextInput value={editing ?? ''} onChangeText={setEditing} placeholder={tr('مثل: جامع الحي', 'e.g. Central Mosque')} placeholderTextColor={t.colors.textFaint} style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }} />
            <Txt variant="caption" muted>
              {tr('أوقات الإقامة تُضبط من «بين الأذان والإقامة».', 'Iqama times are set in “Between adhan and iqama”.')}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={tr('حفظ', 'Save')} style={{ flex: 1 }} onPress={() => (set({ mosqueName: (editing ?? '').trim() }), setEditing(null))} />
              <Button title={tr('إلغاء', 'Cancel')} tone="soft" style={{ flex: 1 }} onPress={() => setEditing(null)} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
