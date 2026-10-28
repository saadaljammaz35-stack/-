import { TabList, TabSlot, Tabs, TabTrigger, type TabSlotProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { BookOpen, Compass, House, LayoutGrid, Sparkles, type LucideIcon } from 'lucide-react-native';
import { forwardRef, useEffect, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import { MiniPlayer } from '@/features/audio/mini-player';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string };

/**
 * Expo Router's tab renderer with one change: a tab out of view is frozen, so the Home
 * countdown or the qibla compass stop re-rendering while another tab is open.
 */
const renderFrozenTab: NonNullable<TabSlotProps['renderFn']> = (descriptor, { isFocused, loaded, detachInactiveScreens }) => {
  if (!loaded && !isFocused) return null;
  return (
    <Screen
      key={descriptor.route.key}
      enabled={detachInactiveScreens}
      activityState={isFocused ? 2 : 0}
      freezeOnBlur
      style={[{ flex: 1, position: 'relative', height: '100%' }, isFocused ? tabStyles.focused : tabStyles.unfocused]}>
      <TabFade navigation={descriptor.navigation}>{descriptor.render()}</TabFade>
    </Screen>
  );
};

type TabNavigation = Parameters<NonNullable<TabSlotProps['renderFn']>>[0]['navigation'];

/**
 * A tab softly fades in each time it comes into view. Driven by the focus event rather than
 * props, because a frozen tab does not re-render until it is already visible.
 */
function TabFade({ navigation, children }: { navigation: TabNavigation; children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        opacity.setValue(0.35);
        Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }),
    [navigation, opacity],
  );
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

const tabStyles = StyleSheet.create({
  focused: { zIndex: 1, display: 'flex', flexShrink: 0, flexGrow: 1 },
  unfocused: { zIndex: -1, display: 'none', flexShrink: 1, flexGrow: 0 },
});

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
      <TabSlot style={{ flex: 1 }} renderFn={renderFrozenTab} />
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
