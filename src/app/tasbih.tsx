import * as Haptics from 'expo-haptics';
import { Plus, RotateCcw, Trash, Vibrate } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, IconButton, ProgressBar, SwitchRow, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, civilKey, civilWeekday } from '@/lib/hijri';
import { useTasbihStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function TasbihScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const fmt = useFormat();
  const today = useToday();
  const s = useTasbihStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('33');
  const active = s.counters.find((c) => c.id === s.activeId) ?? s.counters[0];
  const todayTotal = s.history[civilKey(today)] ?? 0;
  const size = 260;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = active && active.target > 0 ? active.count / active.target : 0;

  const tap = () => {
    const before = active?.rounds ?? 0;
    const after = s.tap(today);
    if (s.vibrate && Platform.OS !== 'web') {
      Haptics.impactAsync(after.rounds > before ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addCivilDays(today, i - 6);
    return { label: fmt.weekdayShort(civilWeekday(d)), value: s.history[civilKey(d)] ?? 0 };
  });
  const maxWeek = Math.max(s.dailyGoal, ...week.map((w) => w.value));

  return (
    <Screen
      title={tr('المسبحة', 'Tasbih')}
      actions={[
        { icon: RotateCcw, label: tr('تصفير', 'Reset'), onPress: () => active && s.reset(active.id) },
        { icon: Plus, label: tr('ذكر جديد', 'New dhikr'), onPress: () => setAdding(true) },
      ]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {s.counters.map((c) => (
          <Chip key={c.id} label={c.label} active={c.id === active?.id} onPress={() => s.select(c.id)} />
        ))}
      </ScrollView>

      {active ? (
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Txt variant="title" center style={{ fontFamily: t.fonts.readingBold }}>
            {active.label}
          </Txt>
          <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={tr('سبّح', 'Count')} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <Svg width={size} height={size}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.colors.primarySoft} strokeWidth={stroke} fill={t.colors.surface} />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={t.colors.primary}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - Math.min(1, pct))}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </Svg>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Txt style={{ fontSize: 64, lineHeight: 80, fontFamily: t.fonts.bold }} color={t.colors.primaryDeep}>
                {active.count}
              </Txt>
              <Txt muted>{active.target > 0 ? tr(`من ${active.target}`, `of ${active.target}`) : tr('بلا حد', 'No limit')}</Txt>
              <Txt variant="caption" muted>
                {tr(`الدورات: ${active.rounds}`, `Rounds: ${active.rounds}`)}
              </Txt>
            </View>
          </Pressable>
          <Txt variant="caption" muted>
            {tr('اضغط على الدائرة للتسبيح', 'Tap the circle to count')}
          </Txt>
        </View>
      ) : null}

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt weight="semibold">{tr('هدف اليوم', 'Today’s goal')}</Txt>
          <Txt muted>{tr(`${todayTotal} من ${s.dailyGoal}`, `${todayTotal} / ${s.dailyGoal}`)}</Txt>
        </View>
        <ProgressBar value={todayTotal / s.dailyGoal} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[100, 300, 500, 1000].map((g) => (
            <Chip key={g} label={String(g)} active={s.dailyGoal === g} onPress={() => s.setGoal(g)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 6 }}>
          {week.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '70%', height: Math.max(3, (w.value / maxWeek) * 64), borderRadius: 6, backgroundColor: i === 6 ? t.colors.primary : t.colors.primarySoft }} />
              <Txt variant="label" muted>
                {w.label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <SwitchRow icon={Vibrate} title={tr('الاهتزاز عند التسبيح', 'Vibrate on tap')} value={s.vibrate} onChange={s.setVibrate} />
      </View>
      {active && !['subhanallah', 'alhamdulillah', 'allahuakbar', 'tahlil', 'istighfar', 'subhanallahi-wabihamdih'].includes(active.id) ? (
        <Button
          title={tr('حذف هذا الذكر', 'Delete this dhikr')}
          icon={Trash}
          tone="plain"
          onPress={() =>
            confirmAsync(tr('حذف الذكر', 'Delete'), active.label, tr('حذف', 'Delete'), tr('إلغاء', 'Cancel')).then((ok) => ok && s.remove(active.id))
          }
        />
      ) : null}

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Txt variant="heading">{tr('ذكر جديد', 'New dhikr')}</Txt>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={tr('نص الذكر', 'Dhikr text')}
              placeholderTextColor={t.colors.textFaint}
              style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }}
            />
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder={tr('العدد المستهدف (0 بلا حد)', 'Target (0 = no limit)')}
              placeholderTextColor={t.colors.textFaint}
              style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, padding: 12, fontFamily: t.fonts.regular, fontSize: 16, color: t.colors.text, textAlign: 'right' }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title={tr('إضافة', 'Add')}
                style={{ flex: 1 }}
                disabled={!label.trim()}
                onPress={() => {
                  s.add(label.trim(), Math.max(0, Number(target) || 0));
                  setLabel('');
                  setAdding(false);
                }}
              />
              <Button title={tr('إلغاء', 'Cancel')} tone="soft" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            </View>
          </Card>
        </View>
      </Modal>
      <View style={{ alignItems: 'center' }}>
        <IconButton icon={RotateCcw} label={tr('تصفير', 'Reset')} onPress={() => active && s.reset(active.id)} />
      </View>
    </Screen>
  );
}
