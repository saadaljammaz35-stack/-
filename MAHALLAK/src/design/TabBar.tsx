import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassSurface, haptic } from './Glass';
import { Icon, type IconName } from './Icon';
import { useTheme } from './theme';
import { brand, fonts, radius } from './tokens';

const TABS: { route: string; icon: IconName; label: string }[] = [
  { route: 'home', icon: 'home', label: 'tabs.home' },
  { route: 'items', icon: 'grid', label: 'tabs.items' },
  { route: 'favorites', icon: 'heart', label: 'tabs.favorites' },
  { route: 'profile', icon: 'user', label: 'tabs.profile' },
];

export const TAB_BAR_SPACE = 118;

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
}

/** Floating glass capsule. The mic sits in the middle, raised, as the primary action. */
export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const tab = (spec: (typeof TABS)[number]) => {
    const route = state.routes.find((r) => r.name === spec.route);
    if (!route) return null;
    const focused = current === spec.route;
    return (
      <Pressable
        key={spec.route}
        testID={`tab-${spec.route}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={t(spec.label)}
        onPress={() => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) {
            haptic('light');
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
      >
        <View style={[styles.tabPill, focused && { backgroundColor: c.hairline }]}>
          <Icon name={spec.icon} size={22} color={focused ? c.text : c.textTertiary} fill={focused && spec.icon === 'heart' ? c.text : 'none'} />
        </View>
        <Text numberOfLines={1} style={[styles.label, { color: focused ? c.text : c.textTertiary, fontFamily: focused ? fonts.semibold : fonts.medium }]}>
          {t(spec.label)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <GlassSurface weight="thick" radius={radius.xl} style={styles.bar}>
        {tab(TABS[0])}
        {tab(TABS[1])}
        <View style={styles.micSlot} />
        {tab(TABS[2])}
        {tab(TABS[3])}
      </GlassSurface>
      <Pressable
        testID="tab-mic"
        accessibilityRole="button"
        accessibilityLabel={t('tabs.voice')}
        onPress={() => {
          haptic('medium');
          router.push('/voice?listen=1');
        }}
        style={[styles.mic, { bottom: Math.max(insets.bottom, 12) + 30, boxShadow: `0px 10px 26px ${c.shadow}` }]}
      >
        <LinearGradient colors={[brand.emeraldBright, brand.emerald, brand.forest]} style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(197,166,106,0.7)' }]} />
        <View>
          <Icon name="mic" size={28} color={brand.goldLight} strokeWidth={2} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', height: 70, paddingHorizontal: 8, width: '100%', maxWidth: 520 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabPill: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 15 },
  micSlot: { width: 74 },
  mic: { position: 'absolute', alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
