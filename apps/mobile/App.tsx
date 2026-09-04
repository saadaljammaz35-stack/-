/**
 * NABD mobile — application root.
 *
 * `applyDirection` runs before the first render because React Native needs a
 * reload for `forceRTL` to take effect. Flipping direction later leaves the app
 * half-mirrored, which in a banking app means amounts and their signs can end
 * up on the wrong side of the screen.
 */

import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { HomeScreen, type TransactionSummary } from './src/screens/HomeScreen.js';
import { applyDirection, type Locale } from './src/i18n/strings.js';

export default function App(): React.JSX.Element {
  const [locale] = useState<Locale>('ar');

  useEffect(() => {
    applyDirection(locale);
  }, [locale]);

  // Placeholder until the API client lands; the shapes match the API exactly,
  // including amounts as minor-unit strings rather than numbers.
  const transactions: TransactionSummary[] = [];

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <HomeScreen
        locale={locale}
        userFirstName="Demo"
        ledgerBalanceMinor="1285075"
        availableBalanceMinor="1285075"
        heldMinor="0"
        currency="SAR"
        incomeMinor="850000"
        expensesMinor="850000"
        transactions={transactions}
      />
    </SafeAreaProvider>
  );
}
