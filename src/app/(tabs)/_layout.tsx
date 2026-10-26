import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { BookOpen, Compass, House, LayoutGrid, Sparkles, type LucideIcon } from 'lucide-react-native';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import { MiniPlayer } from '@/features/audio/mini-player';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string };

const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabButtonProps>(function TabButton({ icon: Icon, label, isFocused, ...props }, ref) {
  const t = useTheme();
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          borderRadius: 26,
          backgroundColor: isFocused ? t.colors.primarySoft : 'transparent',
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Icon size={23} color={isFocused ? t.colors.primaryDeep : t.colors.text} strokeWidth={isFocused ? 2.1 : 1.7} />
      <Txt variant="label" weight={isFocused ? 'semibold' : 'medium'} color={isFocused ? t.colors.primaryDeep : t.colors.text} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Pressable>
  );
});

function Bar({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16 }}>
      <MiniPlayer />
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: t.colors.tabBar,
          borderRadius: 34,
          padding: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}>
        {children}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { tr } = useI18n();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <Bar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon={House} label={tr('الرئيسية', 'Home')} />
          </TabTrigger>
          <TabTrigger name="quran" href="/quran" asChild>
            <TabButton icon={BookOpen} label={tr('القرآن', 'Quran')} />
          </TabTrigger>
          <TabTrigger name="adhkar" href="/adhkar" asChild>
            <TabButton icon={Sparkles} label={tr('الأذكار', 'Adhkar')} />
          </TabTrigger>
          <TabTrigger name="qibla" href="/qibla" asChild>
            <TabButton icon={Compass} label={tr('القبلة', 'Qibla')} />
          </TabTrigger>
          <TabTrigger name="more" href="/more" asChild>
            <TabButton icon={LayoutGrid} label={tr('المزيد', 'More')} />
          </TabTrigger>
        </Bar>
      </TabList>
    </Tabs>
  );
}
