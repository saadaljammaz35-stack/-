import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scrollActivity } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

import { StarPattern } from './brand';
import { IconButton, Txt } from './ui';

export type HeaderAction = { icon: LucideIcon; label: string; onPress: () => void };

export const TAB_BAR_SPACE = 110;

/** Large-title screen used by the five main tabs. */
export function TabScreen({
  title,
  actions = [],
  children,
  scroll = true,
  contentStyle,
  scrollProps,
  hero,
}: {
  title: string;
  actions?: HeaderAction[];
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  /** Full-bleed artwork behind the title (the title turns white over it). */
  hero?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const header = (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="display" color={hero ? '#FFFFFF' : t.colors.primaryDeep} accessibilityRole="header">
          {title}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {actions.map((a) => (
            <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} size={46} />
          ))}
        </View>
      </View>
    </View>
  );
  const top = hero ? (
    <View>
      {hero}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>{header}</View>
    </View>
  ) : (
    header
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {hero ? null : <StarPattern />}
      {scroll ? (
        <ScrollView
          onScrollBeginDrag={scrollActivity.begin}
          onScrollEndDrag={scrollActivity.end}
          onMomentumScrollBegin={scrollActivity.begin}
          onMomentumScrollEnd={scrollActivity.end}
          {...scrollProps}
          contentContainerStyle={[{ paddingBottom: TAB_BAR_SPACE + insets.bottom }, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {top}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {header}
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        </View>
      )}
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { isRTL, tr } = useI18n();
  return (
    <IconButton
      icon={isRTL ? ChevronRight : ChevronLeft}
      label={tr('رجوع', 'Back')}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      size={42}
    />
  );
}

/** Stack screen with a compact header and back button. */
export function Screen({
  title,
  subtitle,
  actions = [],
  children,
  scroll = true,
  contentStyle,
  background,
  scrollProps,
}: {
  title: string;
  subtitle?: string;
  actions?: HeaderAction[];
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
  scrollProps?: ScrollViewProps;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const header = (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <BackButton />
      <View style={{ flex: 1 }}>
        <Txt variant="heading" weight="bold" color={t.colors.primaryDeep} numberOfLines={1} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" muted numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actions.map((a) => (
        <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} size={42} />
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: background ?? t.colors.background }}>
      {header}
      {scroll ? (
        <ScrollView
          {...scrollProps}
          contentContainerStyle={[{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 14 }, contentStyle]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </View>
  );
}
