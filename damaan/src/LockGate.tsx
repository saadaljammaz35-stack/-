import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View, type AppStateStatus } from 'react-native';

import { authenticate } from './services/lock';
import { useSettings } from './services/settings';
import { useTheme } from './theme';
import { Symbol, Text } from './ui';

/**
 * Holds the app behind Face ID when the lock setting is on. The gate closes
 * again whenever the app has been in the background — a receipt archive carries
 * serial numbers, prices and a list of what someone owns.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { settings, loading } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  /**
   * Prompts on its own once the gate is up. The system draws its own modal, so
   * this path needs no local "prompting" state — which also keeps the effect
   * free of a synchronous state update.
   */
  useEffect(() => {
    if (loading || !settings.biometricLock || unlocked) return;

    let cancelled = false;
    void (async () => {
      const success = await authenticate();
      if (!cancelled) setUnlocked(success);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, settings.biometricLock, unlocked]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const wentToBackground = appState.current === 'active' && next !== 'active';
      appState.current = next;
      if (wentToBackground && settings.biometricLock) setUnlocked(false);
    });

    return () => subscription.remove();
  }, [settings.biometricLock]);

  /** The retry button, for when the first prompt was dismissed. */
  async function retry() {
    if (prompting) return;
    setPrompting(true);
    try {
      setUnlocked(await authenticate());
    } finally {
      setPrompting(false);
    }
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }} />;
  if (!settings.biometricLock || unlocked) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.lg,
        backgroundColor: theme.colors.groupedBackground,
      }}
    >
      <Symbol name="lock.shield" size={54} color={theme.colors.brand} />
      <Text variant="title3">ضَمان مقفول</Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.md,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.brand,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text variant="bodyEmphasized" style={{ color: '#FFFFFF' }}>
          {prompting ? 'جارٍ التحقق…' : 'افتح بـ Face ID'}
        </Text>
      </Pressable>
    </View>
  );
}
