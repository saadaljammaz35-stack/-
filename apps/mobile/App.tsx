/**
 * NABD mobile — application root.
 *
 * `applyDirection` runs before the first render because React Native needs a
 * reload for `forceRTL` to take effect. Flipping direction later leaves the app
 * half-mirrored, which in a banking app means amounts and their signs end up on
 * the wrong side of the screen.
 *
 * The screens below are wired to placeholder handlers. Replacing each `onX`
 * with a call to the API client is the only work left to make this live — the
 * screens themselves take and return minor-unit strings, so no float can enter
 * at the boundary.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator, type TabKey } from './src/navigation/RootNavigator.js';
import { CardsScreen, type WalletCard } from './src/screens/CardsScreen.js';
import { HomeScreen, type TransactionSummary } from './src/screens/HomeScreen.js';
import { KycScreen } from './src/screens/KycScreen.js';
import { QrScreen } from './src/screens/QrScreen.js';
import { SendMoneyScreen } from './src/screens/SendMoneyScreen.js';
import { TopUpScreen } from './src/screens/TopUpScreen.js';
import { applyDirection, type Locale } from './src/i18n/strings.js';

export default function App(): React.JSX.Element {
  const [locale] = useState<Locale>('ar');

  useEffect(() => {
    applyDirection(locale);
  }, [locale]);

  // Placeholder state. Shapes match the API exactly, including amounts as
  // minor-unit strings rather than numbers.
  const transactions: TransactionSummary[] = [];
  const cards: WalletCard[] = [];

  const notImplemented = useCallback(async (): Promise<never> => {
    throw new Error('Connect the API client');
  }, []);

  const renderTab = useCallback(
    (tab: TabKey): React.ReactNode => {
      switch (tab) {
        case 'HOME':
          return (
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
          );

        case 'PAYMENTS':
          return (
            <QrScreen
              locale={locale}
              currency="SAR"
              myHandle="+966500000001"
              myDisplayName="Demo User"
              availableBalanceMinor="1285075"
              onPay={notImplemented}
              scannedPayload={null}
            />
          );

        case 'CARDS':
          return (
            <CardsScreen
              locale={locale}
              currency="SAR"
              cards={cards}
              walletBalanceMinor="1285075"
              onFreeze={notImplemented}
              onUnfreeze={notImplemented}
              onIssue={notImplemented}
              canIssueCard={false}
            />
          );

        case 'TRANSFERS':
          return (
            <SendMoneyScreen
              locale={locale}
              currency="SAR"
              availableBalanceMinor="1285075"
              onLookup={notImplemented}
              onSend={notImplemented}
            />
          );

        case 'PROFILE':
          return (
            <KycScreen
              locale={locale}
              status="NOT_STARTED"
              level="FULL"
              documents={[]}
              onUpload={notImplemented}
              onSubmit={notImplemented}
            />
          );

        default:
          return null;
      }
    },
    [locale, transactions, cards, notImplemented],
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootNavigator locale={locale} renderTab={renderTab} />
    </SafeAreaProvider>
  );
}

export { TopUpScreen };
