import { ArrowDown, ArrowUp, Check, RotateCcw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Group, IconButton, IconCircle, Txt } from '@/components/ui';
import { SHORTCUTS, shortcut } from '@/features/shortcuts';
import { useI18n } from '@/i18n';
import { DEFAULT_SHORTCUTS, useSettings, type HomeShortcut } from '@/store/settings';
import { useTheme } from '@/theme';

const MAX = 8;

export default function HomeSettings() {
  const t = useTheme();
  const { tr } = useI18n();
  const selected = useSettings((s) => s.shortcuts);
  const set = useSettings((s) => s.set);

  const toggle = (id: HomeShortcut) => {
    if (selected.includes(id)) set({ shortcuts: selected.filter((x) => x !== id) });
    else if (selected.length < MAX) set({ shortcuts: [...selected, id] });
  };
  const move = (index: number, delta: number) => {
    const next = [...selected];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    set({ shortcuts: next });
  };

  return (
    <Screen title={tr('تخصيص الشاشة الرئيسية', 'Home screen')} subtitle={tr(`${selected.length} من ${MAX} اختصارات`, `${selected.length} of ${MAX} shortcuts`)}>
      <Txt muted>{tr('اختر الاختصارات التي تظهر في الرئيسية ورتّبها.', 'Choose which shortcuts appear on Home and their order.')}</Txt>

      {selected.length ? (
        <Group title={tr('الظاهرة الآن', 'Shown now')}>
          {selected.map((id, i) => {
            const s = shortcut(id);
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
                <IconCircle icon={s.icon} size={36} />
                <Txt weight="medium" style={{ flex: 1 }}>
                  {tr(s.ar, s.en)}
                </Txt>
                <IconButton icon={ArrowUp} label={tr('تقديم', 'Move up')} size={34} tone="plain" disabled={i === 0} onPress={() => move(i, -1)} />
                <IconButton icon={ArrowDown} label={tr('تأخير', 'Move down')} size={34} tone="plain" disabled={i === selected.length - 1} onPress={() => move(i, 1)} />
              </View>
            );
          })}
        </Group>
      ) : null}

      <Group title={tr('كل الاختصارات', 'All shortcuts')}>
        {SHORTCUTS.map((s) => {
          const on = selected.includes(s.id);
          const disabled = !on && selected.length >= MAX;
          return (
            <Pressable
              key={s.id}
              onPress={() => toggle(s.id)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' })}>
              <IconCircle icon={s.icon} size={36} />
              <Txt weight="medium" style={{ flex: 1 }}>
                {tr(s.ar, s.en)}
              </Txt>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? t.colors.primaryDeep : 'transparent',
                  borderWidth: on ? 0 : 1.5,
                  borderColor: t.colors.border,
                }}>
                {on ? <Check size={16} color="#fff" strokeWidth={2.5} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Group>

      <Button title={tr('استعادة الافتراضي', 'Restore defaults')} icon={RotateCcw} tone="soft" onPress={() => set({ shortcuts: DEFAULT_SHORTCUTS })} />
    </Screen>
  );
}
