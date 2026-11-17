import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AmbientBackground, IconButton, Txt } from '@/design/Glass';
import { TAB_BAR_SPACE } from '@/design/TabBar';
import { space } from '@/design/tokens';

export function Screen({
  children,
  title,
  back,
  right,
  scroll = true,
  tabBar = false,
  contentStyle,
  testID,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  tabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {back ? (
          <IconButton
            name="back"
            label={t('common.back')}
            testID="back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          />
        ) : null}
        {title ? (
          <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {right}
      </View>
    ) : (
      <View style={{ height: insets.top }} />
    );
  const bottom = tabBar ? TAB_BAR_SPACE + insets.bottom : insets.bottom + space.xl;
  return (
    <View style={styles.root} testID={testID}>
      <AmbientBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1, paddingBottom: bottom }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md + 2, paddingBottom: space.xs },
  content: { paddingHorizontal: space.md + 2, gap: space.sm, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
