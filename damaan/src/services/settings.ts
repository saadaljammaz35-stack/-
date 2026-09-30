import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_EXCHANGE_DAYS, DEFAULT_RETURN_DAYS } from '../domain/receipt';

const STORAGE_KEY = 'damaan.settings.v1';

export type Settings = {
  /** Printed on claim letters as the claimant. */
  ownerName: string;
  ownerPhone: string;
  notificationsEnabled: boolean;
  /** Require Face ID / Touch ID when the app comes to the foreground. */
  biometricLock: boolean;
  defaultReturnDays: number;
  defaultExchangeDays: number;
};

export const DEFAULT_SETTINGS: Settings = {
  ownerName: '',
  ownerPhone: '',
  notificationsEnabled: true,
  biometricLock: false,
  defaultReturnDays: DEFAULT_RETURN_DAYS,
  defaultExchangeDays: DEFAULT_EXCHANGE_DAYS,
};

type SettingsContextValue = {
  settings: Settings;
  /** True until the stored settings have been read at least once. */
  loading: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function merge(stored: unknown): Settings {
  if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS;
  const candidate = stored as Partial<Settings>;

  return {
    ownerName: typeof candidate.ownerName === 'string' ? candidate.ownerName : DEFAULT_SETTINGS.ownerName,
    ownerPhone: typeof candidate.ownerPhone === 'string' ? candidate.ownerPhone : DEFAULT_SETTINGS.ownerPhone,
    notificationsEnabled:
      typeof candidate.notificationsEnabled === 'boolean'
        ? candidate.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    biometricLock:
      typeof candidate.biometricLock === 'boolean' ? candidate.biometricLock : DEFAULT_SETTINGS.biometricLock,
    defaultReturnDays:
      typeof candidate.defaultReturnDays === 'number' ? candidate.defaultReturnDays : DEFAULT_SETTINGS.defaultReturnDays,
    defaultExchangeDays:
      typeof candidate.defaultExchangeDays === 'number'
        ? candidate.defaultExchangeDays
        : DEFAULT_SETTINGS.defaultExchangeDays,
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) setSettings(merge(JSON.parse(raw)));
      } catch {
        // Unreadable settings fall back to defaults rather than blocking launch.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(() => ({ settings, loading, update }), [settings, loading, update]);

  return React.createElement(SettingsContext.Provider, { value }, children);
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
