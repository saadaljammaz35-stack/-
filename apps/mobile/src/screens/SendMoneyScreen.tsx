/**
 * Send money to a phone number.
 *
 * The flow is three steps on purpose — number, amount, confirm — because the
 * confirmation step is a fraud control, not a formality. A transfer inside a
 * wallet is instant and irreversible; the moment before it commits is the only
 * moment the sender can catch a wrong digit. So the recipient's name is fetched
 * and shown large, and the confirm button says the amount and the name together.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { Money, type CurrencyCode, tryNormalisePhone } from '@nabd/shared';
import {
  MIN_TOUCH_TARGET,
  darkTheme,
  lightTheme,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '@nabd/ui';

import { isRtl, t, type Locale } from '../i18n/strings.js';

export interface Recipient {
  displayName: string;
  maskedPhone: string;
}

export interface SendMoneyScreenProps {
  locale: Locale;
  currency: CurrencyCode;
  availableBalanceMinor: string;
  /** Remaining daily headroom from the wallet's tier, if it is binding. */
  remainingDailyMinor?: string;
  onLookup: (phone: string) => Promise<Recipient>;
  onSend: (params: {
    phone: string;
    amountMinor: string;
    note?: string;
  }) => Promise<{ reference: string }>;
  onDone?: () => void;
}

type Step = 'PHONE' | 'AMOUNT' | 'CONFIRM' | 'SENT';

export function SendMoneyScreen(props: SendMoneyScreenProps): React.JSX.Element {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkTheme : lightTheme;
  const rtl = isRtl(props.locale);
  const styles = useMemo(() => createStyles(colors, rtl), [colors, rtl]);

  const [step, setStep] = useState<Step>('PHONE');
  const [phone, setPhone] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = Money.fromMinor(props.availableBalanceMinor, props.currency);

  // Validated as the customer types, so the Continue button reflects reality
  // rather than failing after a round trip.
  const normalisedPhone = tryNormalisePhone(phone);

  const parsedAmount = useMemo(() => {
    if (amountText.trim() === '') return null;
    try {
      return Money.fromMajor(amountText, props.currency);
    } catch {
      return null;
    }
  }, [amountText, props.currency]);

  const amountProblem = useMemo(() => {
    if (parsedAmount === null) return null;
    if (!parsedAmount.isPositive) return t(props.locale, 'errorGeneric');
    if (parsedAmount.greaterThan(available))
      return t(props.locale, 'errorInsufficientFunds');
    if (props.remainingDailyMinor !== undefined) {
      const remaining = Money.fromMinor(props.remainingDailyMinor, props.currency);
      if (parsedAmount.greaterThan(remaining)) return t(props.locale, 'upgradeToRaise');
    }
    return null;
  }, [parsedAmount, available, props.remainingDailyMinor, props.currency, props.locale]);

  const lookup = useCallback(async () => {
    if (normalisedPhone === null) return;
    setBusy(true);
    setError(null);
    try {
      setRecipient(await props.onLookup(normalisedPhone));
      setStep('AMOUNT');
    } catch {
      setError(t(props.locale, 'recipientNotFound'));
    } finally {
      setBusy(false);
    }
  }, [normalisedPhone, props]);

  const send = useCallback(async () => {
    if (normalisedPhone === null || parsedAmount === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await props.onSend({
        phone: normalisedPhone,
        // Minor units as a string — no float crosses the wire.
        amountMinor: parsedAmount.minor.toString(),
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      });
      setReference(result.reference);
      setStep('SENT');
    } catch (e) {
      setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
    } finally {
      setBusy(false);
    }
  }, [normalisedPhone, parsedAmount, note, props]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── step 1: who ── */}
        {step === 'PHONE' && (
          <View>
            <Text style={styles.title}>{t(props.locale, 'sendToPhone')}</Text>
            <Text style={styles.hint}>{t(props.locale, 'instantFree')}</Text>

            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="05X XXX XXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              accessibilityLabel={t(props.locale, 'recipientPhone')}
              maxLength={20}
            />

            {phone.length > 3 && normalisedPhone === null && (
              <Text style={styles.error}>{t(props.locale, 'errorGeneric')}</Text>
            )}
            {error !== null && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              label={t(props.locale, 'confirmRecipient')}
              onPress={lookup}
              disabled={normalisedPhone === null || busy}
              busy={busy}
              colors={colors}
              rtl={rtl}
            />
          </View>
        )}

        {/* ── step 2: how much ── */}
        {step === 'AMOUNT' && recipient !== null && (
          <View>
            <Text style={styles.title}>{t(props.locale, 'amountToSend')}</Text>

            <View style={styles.recipientCard}>
              <Text style={styles.recipientLabel}>{t(props.locale, 'sendingTo')}</Text>
              <Text style={styles.recipientName}>{recipient.displayName}</Text>
              <Text style={styles.recipientPhone}>{recipient.maskedPhone}</Text>
            </View>

            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel={t(props.locale, 'amountToSend')}
              maxLength={12}
            />
            <Text style={styles.balanceHint}>
              {t(props.locale, 'availableBalance')}: {available.format(props.locale)}
            </Text>

            {amountProblem !== null && <Text style={styles.error}>{amountProblem}</Text>}

            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              maxLength={140}
            />

            <PrimaryButton
              label={t(props.locale, 'confirmAndSend')}
              onPress={() => setStep('CONFIRM')}
              disabled={parsedAmount === null || amountProblem !== null}
              colors={colors}
              rtl={rtl}
            />
          </View>
        )}

        {/* ── step 3: confirm ──
            The last moment a wrong digit can be caught. A wallet transfer is
            instant and irreversible, so the amount and the name are shown
            together, large, before anything commits. */}
        {step === 'CONFIRM' && recipient !== null && parsedAmount !== null && (
          <View>
            <Text style={styles.title}>{t(props.locale, 'confirmAndSend')}</Text>

            <View style={styles.confirmCard}>
              <Text style={styles.confirmAmount}>{parsedAmount.format(props.locale)}</Text>
              <Text style={styles.confirmTo}>{t(props.locale, 'sendingTo')}</Text>
              <Text style={styles.recipientName}>{recipient.displayName}</Text>
              <Text style={styles.recipientPhone}>{recipient.maskedPhone}</Text>
              {note.trim() !== '' && <Text style={styles.confirmNote}>{note}</Text>}
            </View>

            {error !== null && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              label={t(props.locale, 'confirmAndSend')}
              onPress={send}
              disabled={busy}
              busy={busy}
              colors={colors}
              rtl={rtl}
            />
            <Pressable
              onPress={() => setStep('AMOUNT')}
              style={styles.secondaryButton}
              disabled={busy}
            >
              <Text style={styles.secondaryLabel}>{t(props.locale, 'retry')}</Text>
            </Pressable>
          </View>
        )}

        {/* ── done ── */}
        {step === 'SENT' && parsedAmount !== null && recipient !== null && (
          <View style={styles.successBlock}>
            <View style={styles.successMark}>
              <Text style={styles.successMarkText}>✓</Text>
            </View>
            <Text style={styles.confirmAmount}>{parsedAmount.format(props.locale)}</Text>
            <Text style={styles.recipientName}>{recipient.displayName}</Text>
            {reference !== null && <Text style={styles.reference}>{reference}</Text>}
            <PrimaryButton
              label={t(props.locale, 'navHome')}
              onPress={() => props.onDone?.()}
              colors={colors}
              rtl={rtl}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  colors: ThemeColors;
  rtl: boolean;
}): React.JSX.Element {
  const styles = createStyles(props.colors, props.rtl);
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled === true || props.busy === true}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      style={({ pressed }) => [
        styles.primaryButton,
        props.disabled === true && styles.primaryButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {props.busy === true ? (
        <ActivityIndicator color={props.colors.onPrimary} />
      ) : (
        <Text style={styles.primaryLabel}>{props.label}</Text>
      )}
    </Pressable>
  );
}

function createStyles(
  colors: ThemeColors,
  rtl: boolean,
): ReturnType<typeof StyleSheet.create> {
  const dir = rtl ? 'rtl' : 'ltr';
  const textAlign = rtl ? ('right' as const) : ('left' as const);

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.base, paddingBottom: spacing.xxl },

    title: {
      ...typography.title,
      color: colors.textPrimary,
      textAlign,
      writingDirection: dir,
      marginBottom: spacing.xs,
    },
    hint: {
      ...typography.caption,
      color: colors.success,
      textAlign,
      writingDirection: dir,
      marginBottom: spacing.lg,
    },

    input: {
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.base,
      minHeight: MIN_TOUCH_TARGET,
      marginBottom: spacing.md,
      textAlign,
      writingDirection: dir,
    },
    amountInput: {
      ...typography.balance,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.base,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    balanceHint: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: spacing.md,
    },

    recipientCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.base,
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    recipientLabel: { ...typography.micro, color: colors.textMuted },
    recipientName: {
      ...typography.heading,
      color: colors.textPrimary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    recipientPhone: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

    confirmCard: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    confirmAmount: {
      ...typography.balance,
      color: colors.onPrimary,
      marginBottom: spacing.sm,
    },
    confirmTo: { ...typography.micro, color: colors.onPrimary, opacity: 0.8 },
    confirmNote: {
      ...typography.caption,
      color: colors.onPrimary,
      opacity: 0.9,
      marginTop: spacing.sm,
      textAlign: 'center',
    },

    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      minHeight: MIN_TOUCH_TARGET + 4,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.base,
    },
    primaryButtonDisabled: { opacity: 0.4 },
    primaryLabel: { ...typography.bodyStrong, color: colors.onPrimary },
    secondaryButton: {
      minHeight: MIN_TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    secondaryLabel: { ...typography.caption, color: colors.textSecondary },
    pressed: { opacity: 0.7 },

    error: {
      ...typography.caption,
      color: colors.danger,
      textAlign,
      writingDirection: dir,
      marginBottom: spacing.sm,
    },

    successBlock: { alignItems: 'center', paddingTop: spacing.xxl },
    successMark: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: colors.successSurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    successMarkText: { fontSize: 36, color: colors.success },
    reference: {
      ...typography.micro,
      color: colors.textMuted,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
  });
}
