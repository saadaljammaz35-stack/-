/**
 * QR — receive and pay.
 *
 * The paying half is the security-sensitive one. A scanned code is untrusted
 * input arriving from a sticker anyone could have replaced, so the flow is:
 * parse → verify checksum → check payability → **show the merchant and amount
 * and wait for a deliberate tap**. It never pays on scan.
 *
 * `checkQrPayment` in `@nabd/payments` makes the decision; this screen only
 * renders it. That keeps the rule — when a code carries an amount, the customer
 * pays that amount and nothing else — in tested code rather than in a component.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Money, type CurrencyCode } from '@nabd/shared';
import {
  buildQrPayload,
  checkQrPayment,
  type ParsedQr,
  tryParseQrPayload,
} from '@nabd/payments';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '@nabd/ui';

import {
  Card,
  ErrorText,
  PrimaryButton,
  ScreenTitle,
  SecondaryButton,
  sharedStyles,
  useTheme,
} from '../components/primitives.js';
import { isRtl, t, type Locale } from '../i18n/strings.js';

export interface QrScreenProps {
  locale: Locale;
  currency: CurrencyCode;
  /** This wallet's own handle — used to refuse self-payment. */
  myHandle: string;
  myDisplayName: string;
  availableBalanceMinor: string;
  /** References of dynamic codes already paid, so one cannot be paid twice. */
  paidReferences?: ReadonlySet<string>;
  onPay: (params: {
    payload: string;
    amountMinor: string;
    merchantHandle: string;
  }) => Promise<{ reference: string }>;
  /** Supplied by the camera in the real app; injectable so the flow is testable. */
  scannedPayload?: string | null;
  onRequestScan?: () => void;
}

type Mode = 'RECEIVE' | 'PAY';

export function QrScreen(props: QrScreenProps): React.JSX.Element {
  const colors = useTheme();
  const rtl = isRtl(props.locale);
  const [mode, setMode] = useState<Mode>('RECEIVE');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [enteredAmount, setEnteredAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidReference, setPaidReference] = useState<string | null>(null);

  // ── my code ──
  const myPayload = useMemo(() => {
    let amount: Money | undefined;
    if (requestedAmount.trim() !== '') {
      try {
        const parsed = Money.fromMajor(requestedAmount, props.currency);
        if (parsed.isPositive) amount = parsed;
      } catch {
        amount = undefined;
      }
    }
    try {
      return buildQrPayload({
        ...(amount === undefined ? {} : { amount }),
        currency: props.currency,
        merchantName: 'NABD User',
        merchantCity: 'Riyadh',
        merchantNameAr: props.myDisplayName,
        nabdHandle: props.myHandle,
        // A fresh reference each time an amount is requested, so a screenshot
        // of an old request cannot be paid again.
        ...(amount === undefined
          ? {}
          : { reference: `RQ-${Date.now().toString(36).toUpperCase()}` }),
      });
    } catch {
      return null;
    }
  }, [requestedAmount, props.currency, props.myHandle, props.myDisplayName]);

  // ── a scanned code ──
  const scanned: ParsedQr | null = useMemo(
    () =>
      props.scannedPayload === undefined || props.scannedPayload === null
        ? null
        : tryParseQrPayload(props.scannedPayload),
    [props.scannedPayload],
  );

  const decision = useMemo(() => {
    if (scanned === null) return null;
    let entered: Money | undefined;
    if (enteredAmount.trim() !== '') {
      try {
        entered = Money.fromMajor(enteredAmount, props.currency);
      } catch {
        entered = undefined;
      }
    }
    return checkQrPayment({
      parsed: scanned,
      payerHandle: props.myHandle,
      ...(entered === undefined ? {} : { enteredAmount: entered }),
      supportedCurrencies: [props.currency],
      ...(props.paidReferences === undefined
        ? {}
        : { usedReferences: props.paidReferences }),
    });
  }, [scanned, enteredAmount, props.currency, props.myHandle, props.paidReferences]);

  const rejectionMessage = useMemo(() => {
    if (
      props.scannedPayload !== undefined &&
      props.scannedPayload !== null &&
      scanned === null
    ) {
      return t(props.locale, 'qrInvalid');
    }
    if (decision === null || decision.acceptable || decision.requiresAmountEntry)
      return null;
    switch (decision.reason) {
      case 'NOT_A_NABD_CODE':
        return t(props.locale, 'qrNotNabd');
      case 'SELF_PAYMENT':
        return t(props.locale, 'qrSelfPay');
      case 'DYNAMIC_CODE_REUSED':
        return t(props.locale, 'qrAlreadyPaid');
      case 'CURRENCY_NOT_SUPPORTED':
        return t(props.locale, 'errorGeneric');
      case 'AMOUNT_MISMATCH':
        return t(props.locale, 'errorGeneric');
      default:
        return t(props.locale, 'qrInvalid');
    }
  }, [decision, scanned, props.scannedPayload, props.locale]);

  const pay = useCallback(async () => {
    if (
      decision === null ||
      !decision.acceptable ||
      decision.amountToPay === null ||
      scanned?.nabdHandle == null ||
      props.scannedPayload == null
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await props.onPay({
        payload: props.scannedPayload,
        amountMinor: decision.amountToPay.minor.toString(),
        merchantHandle: scanned.nabdHandle,
      });
      setPaidReference(result.reference);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
    } finally {
      setBusy(false);
    }
  }, [decision, scanned, props]);

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* mode switch */}
      <View
        style={{
          flexDirection: rtl ? 'row-reverse' : 'row',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xs,
          marginBottom: spacing.lg,
        }}
      >
        {(['RECEIVE', 'PAY'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET - 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: mode === value ? colors.primary : 'transparent',
            }}
          >
            <Text
              style={{
                ...typography.caption,
                color: mode === value ? colors.onPrimary : colors.textSecondary,
              }}
            >
              {t(props.locale, value === 'RECEIVE' ? 'myQr' : 'scanQr')}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'RECEIVE' ? (
        <View>
          <ScreenTitle
            title={t(props.locale, 'myQr')}
            subtitle={t(props.locale, 'myQrHint')}
            rtl={rtl}
          />

          <Card>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              {/* The renderer is supplied by the host app; the payload below is
                  the real EMVCo string any compliant wallet can read. */}
              <View
                style={{
                  width: 220,
                  height: 220,
                  backgroundColor: colors.background,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                accessibilityLabel={t(props.locale, 'myQr')}
              >
                <Text style={{ ...typography.micro, color: colors.textMuted }}>QR</Text>
              </View>

              <Text
                style={{
                  ...typography.heading,
                  color: colors.textPrimary,
                  marginTop: spacing.base,
                }}
              >
                {props.myDisplayName}
              </Text>
            </View>
          </Card>

          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textAlign: rtl ? 'right' : 'left',
              marginBottom: spacing.sm,
            }}
          >
            {t(props.locale, 'requestAmount')}
          </Text>
          <TextInput
            style={{
              ...typography.body,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.base,
              minHeight: MIN_TOUCH_TARGET,
              textAlign: 'center',
            }}
            value={requestedAmount}
            onChangeText={setRequestedAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            maxLength={12}
          />

          {myPayload === null && (
            <ErrorText message={t(props.locale, 'errorGeneric')} rtl={rtl} />
          )}
        </View>
      ) : (
        <View>
          <ScreenTitle title={t(props.locale, 'scanQr')} rtl={rtl} />

          {paidReference !== null ? (
            <View style={[sharedStyles.centered, { paddingVertical: spacing.xxl }]}>
              <Text style={{ fontSize: 44, color: colors.success }}>✓</Text>
              <Text
                style={{
                  ...typography.micro,
                  color: colors.textMuted,
                  marginTop: spacing.sm,
                }}
              >
                {paidReference}
              </Text>
            </View>
          ) : scanned === null ? (
            <View>
              <Card>
                <View style={[sharedStyles.centered, { paddingVertical: spacing.xxl }]}>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>
                    {t(props.locale, 'scanning')}
                  </Text>
                </View>
              </Card>
              {rejectionMessage !== null && (
                <ErrorText message={rejectionMessage} rtl={rtl} />
              )}
              <SecondaryButton
                label={t(props.locale, 'scanQr')}
                onPress={() => props.onRequestScan?.()}
              />
            </View>
          ) : (
            <View>
              <Card>
                <View style={{ alignItems: 'center', paddingVertical: spacing.base }}>
                  <Text style={{ ...typography.micro, color: colors.textMuted }}>
                    {t(props.locale, 'payMerchant')}
                  </Text>
                  <Text
                    style={{
                      ...typography.heading,
                      color: colors.textPrimary,
                      marginTop: spacing.xs,
                      textAlign: 'center',
                    }}
                  >
                    {scanned.merchantNameAr ?? scanned.merchantName}
                  </Text>

                  {decision?.amountToPay !== null &&
                    decision?.amountToPay !== undefined && (
                      <Text
                        style={{
                          ...typography.balance,
                          color: colors.textPrimary,
                          marginTop: spacing.md,
                        }}
                      >
                        {decision.amountToPay.format(props.locale)}
                      </Text>
                    )}
                </View>
              </Card>

              {/* A static code carries no amount, so the payer supplies one. */}
              {decision?.requiresAmountEntry === true && (
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
                  value={enteredAmount}
                  onChangeText={setEnteredAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  maxLength={12}
                />
              )}

              {rejectionMessage !== null && (
                <ErrorText message={rejectionMessage} rtl={rtl} />
              )}
              {error !== null && <ErrorText message={error} rtl={rtl} />}

              <PrimaryButton
                label={t(props.locale, 'confirmAndSend')}
                onPress={pay}
                disabled={decision?.acceptable !== true}
                busy={busy}
              />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
