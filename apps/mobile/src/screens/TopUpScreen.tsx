/**
 * Add money to the wallet.
 *
 * The screen's job is to be honest about timing. Funding comes from an outside
 * system, and the balance does not move until that system confirms — so the
 * success state here says "awaiting confirmation", not "done". Showing a
 * credited balance the instant the customer taps would be showing them money
 * that may never arrive, and they can spend it in the meantime.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Money, type CurrencyCode } from '@nabd/shared';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '@nabd/ui';

import {
  Card,
  ErrorText,
  PrimaryButton,
  ScreenTitle,
  sharedStyles,
  useTheme,
} from '../components/primitives.js';
import { isRtl, t, type Locale } from '../i18n/strings.js';

export type TopUpSource = 'CARD' | 'BANK_TRANSFER' | 'APPLE_PAY';

export interface TopUpScreenProps {
  locale: Locale;
  currency: CurrencyCode;
  /** Headroom before the wallet's tier balance cap is reached. */
  remainingBalanceCapMinor?: string;
  onTopUp: (params: {
    amountMinor: string;
    source: TopUpSource;
  }) => Promise<{ status: 'PENDING' | 'COMPLETED'; reference: string }>;
  onDone?: () => void;
}

const QUICK_AMOUNTS = ['50', '100', '200', '500'] as const;

export function TopUpScreen(props: TopUpScreenProps): React.JSX.Element {
  const colors = useTheme();
  const rtl = isRtl(props.locale);
  const align = rtl ? ('right' as const) : ('left' as const);

  const [amountText, setAmountText] = useState('');
  const [source, setSource] = useState<TopUpSource>('CARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reference: string } | null>(null);

  const parsed = useMemo(() => {
    if (amountText.trim() === '') return null;
    try {
      return Money.fromMajor(amountText, props.currency);
    } catch {
      return null;
    }
  }, [amountText, props.currency]);

  // Rejecting here, before the payment is taken, is far kinder than taking the
  // money and refusing the credit because the wallet cap would be breached.
  const capProblem = useMemo(() => {
    if (parsed === null || props.remainingBalanceCapMinor === undefined) return null;
    const headroom = Money.fromMinor(props.remainingBalanceCapMinor, props.currency);
    return parsed.greaterThan(headroom) ? t(props.locale, 'upgradeToRaise') : null;
  }, [parsed, props.remainingBalanceCapMinor, props.currency, props.locale]);

  const submit = useCallback(async () => {
    if (parsed === null) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await props.onTopUp({ amountMinor: parsed.minor.toString(), source }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
    } finally {
      setBusy(false);
    }
  }, [parsed, source, props]);

  if (result !== null) {
    const pending = result.status === 'PENDING';
    return (
      <View
        style={[
          sharedStyles.screen,
          { backgroundColor: colors.background, padding: spacing.base },
        ]}
      >
        <View style={[sharedStyles.centered, { flex: 1 }]}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.pill,
              backgroundColor: pending ? colors.warningSurface : colors.successSurface,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Text
              style={{ fontSize: 34, color: pending ? colors.warning : colors.success }}
            >
              {pending ? '⏳' : '✓'}
            </Text>
          </View>

          <Text
            style={{
              ...typography.heading,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {t(props.locale, pending ? 'topUpPending' : 'topUpDone')}
          </Text>

          {/* The honest part: the balance has not moved yet. */}
          {pending && (
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
              }}
            >
              {t(props.locale, 'topUpPendingHint')}
            </Text>
          )}

          <Text
            style={{
              ...typography.micro,
              color: colors.textMuted,
              marginTop: spacing.base,
            }}
          >
            {result.reference}
          </Text>

          <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
            <PrimaryButton
              label={t(props.locale, 'navHome')}
              onPress={() => props.onDone?.()}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[sharedStyles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={sharedStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle title={t(props.locale, 'topUpTitle')} rtl={rtl} />

        <TextInput
          style={{
            ...typography.balance,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.base,
            textAlign: 'center',
            marginBottom: spacing.md,
          }}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel={t(props.locale, 'amountToSend')}
          maxLength={12}
        />

        <View
          style={{
            flexDirection: rtl ? 'row-reverse' : 'row',
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          {QUICK_AMOUNTS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setAmountText(value)}
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  flex: 1,
                  minHeight: MIN_TOUCH_TARGET,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={{ ...typography.caption, color: colors.textPrimary }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: align,
            marginBottom: spacing.sm,
          }}
        >
          {t(props.locale, 'topUpSource')}
        </Text>

        <Card padded={false}>
          {(
            [
              ['CARD', 'sourceCard'],
              ['BANK_TRANSFER', 'sourceBankTransfer'],
              ['APPLE_PAY', 'sourceApplePay'],
            ] as const
          ).map(([value, labelKey], index) => (
            <Pressable
              key={value}
              onPress={() => setSource(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: source === value }}
              style={({ pressed }) => [
                {
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.base,
                  minHeight: MIN_TOUCH_TARGET,
                  borderBottomWidth: index === 2 ? 0 : 1,
                  borderBottomColor: colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={{ ...typography.body, color: colors.textPrimary }}>
                {t(props.locale, labelKey)}
              </Text>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: source === value ? colors.primary : colors.border,
                  backgroundColor: source === value ? colors.primary : 'transparent',
                }}
              />
            </Pressable>
          ))}
        </Card>

        {capProblem !== null && <ErrorText message={capProblem} rtl={rtl} />}
        {error !== null && <ErrorText message={error} rtl={rtl} />}

        <PrimaryButton
          label={t(props.locale, 'topUpTitle')}
          onPress={submit}
          disabled={parsed === null || !parsed.isPositive || capProblem !== null}
          busy={busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
