/**
 * Navigation shell.
 *
 * Five bottom tabs, matching the wallet's actual jobs. Two details are
 * deliberate:
 *
 *  1. In RTL the tab order mirrors, so "Home" sits under the thumb on the same
 *     side an Arabic reader expects. `I18nManager` handles this once
 *     `applyDirection` has run at startup; the explicit `row-reverse` here
 *     keeps a screenshot correct even before a reload.
 *  2. Every tab meets the 44pt touch target. A mis-tap in a banking app is not
 *     a cosmetic problem.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH_TARGET, spacing, typography } from '@nabd/ui';

import { useTheme } from '../components/primitives.js';
import { isRtl, t, type Locale, type StringKey } from '../i18n/strings.js';

export type TabKey = 'HOME' | 'PAYMENTS' | 'CARDS' | 'TRANSFERS' | 'PROFILE';

const TABS: Array<{ key: TabKey; icon: string; label: StringKey }> = [
  { key: 'HOME', icon: '⌂', label: 'navHome' },
  { key: 'PAYMENTS', icon: '▦', label: 'navPayments' },
  { key: 'CARDS', icon: '▭', label: 'navCards' },
  { key: 'TRANSFERS', icon: '⇄', label: 'navTransfers' },
  { key: 'PROFILE', icon: '☺', label: 'navProfile' },
];

export interface RootNavigatorProps {
  locale: Locale;
  /** Rendered content for the active tab, supplied by the host app. */
  renderTab: (tab: TabKey) => React.ReactNode;
  initialTab?: TabKey;
}

export function RootNavigator(props: RootNavigatorProps): React.JSX.Element {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const rtl = isRtl(props.locale);
  const [active, setActive] = useState<TabKey>(props.initialTab ?? 'HOME');

  const ordered = useMemo(() => (rtl ? [...TABS].reverse() : TABS), [rtl]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>{props.renderTab(active)}</View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
        }}
        accessibilityRole="tablist"
      >
        {ordered.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActive(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(props.locale, tab.label)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  minHeight: MIN_TOUCH_TARGET,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing.xs,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text
                style={{
                  fontSize: 20,
                  color: selected ? colors.primary : colors.textMuted,
                  marginBottom: 2,
                }}
              >
                {tab.icon}
              </Text>
              <Text
                style={{
                  ...typography.micro,
                  color: selected ? colors.primary : colors.textMuted,
                }}
                numberOfLines={1}
              >
                {t(props.locale, tab.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
