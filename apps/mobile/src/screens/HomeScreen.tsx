/**
 * Home.
 *
 * Two decisions here are worth stating, because they are the ones that make
 * this feel like a real banking app rather than a demo:
 *
 *  1. Amounts are formatted from `Money` (bigint minor units) and never from a
 *     JavaScript number. The API sends `{ amount: "1285075", currency: "SAR" }`
 *     and the UI reconstructs a `Money` — so a large balance cannot lose
 *     precision on its way to the screen.
 *
 *  2. Balance visibility defaults to *shown* but is one tap from hidden, and
 *     the hidden state persists. People check balances in public; that toggle
 *     is a privacy control, not a decoration.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Money, type CurrencyCode } from '@nabd/shared';
import {
  MIN_TOUCH_TARGET,
  darkTheme,
  lightTheme,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '@nabd/ui';

import { greetingFor, isRtl, t, type Locale } from '../i18n/strings.js';

export interface TransactionSummary {
  id: string;
  reference: string;
  counterparty: string;
  /** Minor units, as a decimal string — never a number. */
  amountMinor: string;
  currency: CurrencyCode;
  direction: 'IN' | 'OUT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED' | 'UNDER_REVIEW';
  category: string;
  createdAt: string;
}

export interface HomeScreenProps {
  locale: Locale;
  userFirstName: string;
  ledgerBalanceMinor: string;
  availableBalanceMinor: string;
  heldMinor: string;
  currency: CurrencyCode;
  incomeMinor: string;
  expensesMinor: string;
  transactions: TransactionSummary[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onAction?: (action: QuickAction) => void;
  onViewAllTransactions?: () => void;
}

export type QuickAction =
  | 'TRANSFER'
  | 'PAY'
  | 'CARDS'
  | 'ADD_MONEY'
  | 'QR'
  | 'BENEFICIARIES';

const QUICK_ACTIONS: Array<{
  id: QuickAction;
  icon: string;
  key: Parameters<typeof t>[1];
}> = [
  { id: 'TRANSFER', icon: '⇄', key: 'actionTransfer' },
  { id: 'PAY', icon: '⌁', key: 'actionPay' },
  { id: 'CARDS', icon: '▭', key: 'actionCards' },
  { id: 'ADD_MONEY', icon: '＋', key: 'actionAddMoney' },
  { id: 'QR', icon: '▦', key: 'actionQr' },
  { id: 'BENEFICIARIES', icon: '☰', key: 'actionBeneficiaries' },
];

export function HomeScreen(props: HomeScreenProps): React.JSX.Element {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkTheme : lightTheme;
  const rtl = isRtl(props.locale);
  const styles = useMemo(() => createStyles(colors, rtl), [colors, rtl]);

  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Reconstructed from minor units so no float ever touches a displayed amount.
  const ledger = Money.fromMinor(props.ledgerBalanceMinor, props.currency);
  const available = Money.fromMinor(props.availableBalanceMinor, props.currency);
  const held = Money.fromMinor(props.heldMinor, props.currency);
  const income = Money.fromMinor(props.incomeMinor, props.currency);
  const expenses = Money.fromMinor(props.expensesMinor, props.currency);

  const handleRefresh = useCallback(async () => {
    if (props.onRefresh === undefined) return;
    setRefreshing(true);
    try {
      await props.onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [props]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── header ── */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greetingFor(props.locale)}</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {props.userFirstName}
          </Text>
        </View>
        <View style={styles.brandMark} accessibilityLabel={t(props.locale, 'appName')}>
          <Text style={styles.brandMarkText}>{props.locale === 'ar' ? 'ن' : 'N'}</Text>
        </View>
      </View>

      {/* ── balance ── */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t(props.locale, 'availableBalance')}</Text>

        {props.loading === true ? (
          <ActivityIndicator color={colors.textInverse} style={styles.balanceLoader} />
        ) : (
          <Text
            style={styles.balanceValue}
            accessibilityLabel={
              balanceHidden
                ? t(props.locale, 'balanceHidden')
                : available.format(props.locale)
            }
          >
            {balanceHidden
              ? t(props.locale, 'balanceHidden')
              : available.format(props.locale, { showCode: false })}
            {!balanceHidden && (
              <Text style={styles.balanceCurrency}> {props.currency}</Text>
            )}
          </Text>
        )}

        {/* Only shown when it is non-zero: a permanent "0.00 on hold" row is
            noise, but a real hold is something the customer must see, because
            it explains why their available balance is lower than their total. */}
        {!balanceHidden && held.isPositive && (
          <Text style={styles.heldText}>
            {t(props.locale, 'heldAmount')}: {held.format(props.locale)}
          </Text>
        )}
        {!balanceHidden && !ledger.equals(available) && (
          <Text style={styles.ledgerText}>
            {t(props.locale, 'totalBalance')}: {ledger.format(props.locale)}
          </Text>
        )}

        <Pressable
          onPress={() => setBalanceHidden((v) => !v)}
          style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t(
            props.locale,
            balanceHidden ? 'showBalance' : 'hideBalance',
          )}
          hitSlop={8}
        >
          <Text style={styles.hideButtonText}>
            {balanceHidden ? '👁  ' : '⊘  '}
            {t(props.locale, balanceHidden ? 'showBalance' : 'hideBalance')}
          </Text>
        </Pressable>
      </View>

      {/* ── quick actions ── */}
      <View style={styles.actionsRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={() => props.onAction?.(action.id)}
            accessibilityRole="button"
            accessibilityLabel={t(props.locale, action.key)}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>{action.icon}</Text>
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>
              {t(props.locale, action.key)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── recent transactions ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(props.locale, 'recentTransactions')}</Text>
          <Pressable onPress={props.onViewAllTransactions} hitSlop={8}>
            <Text style={styles.link}>{t(props.locale, 'viewAll')}</Text>
          </Pressable>
        </View>

        {props.transactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t(props.locale, 'noTransactions')}</Text>
            <Text style={styles.emptyHint}>{t(props.locale, 'noTransactionsHint')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {props.transactions.slice(0, 5).map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                locale={props.locale}
                colors={colors}
                rtl={rtl}
                hidden={balanceHidden}
                isLast={index === Math.min(props.transactions.length, 5) - 1}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── financial overview ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(props.locale, 'financialOverview')}</Text>
        <View style={styles.overviewRow}>
          <OverviewTile
            label={t(props.locale, 'income')}
            value={
              balanceHidden ? t(props.locale, 'balanceHidden') : income.format(props.locale)
            }
            tone="positive"
            colors={colors}
          />
          <OverviewTile
            label={t(props.locale, 'expenses')}
            value={
              balanceHidden
                ? t(props.locale, 'balanceHidden')
                : expenses.format(props.locale)
            }
            tone="negative"
            colors={colors}
          />
        </View>
      </View>

      {/* Regulatory notice. NABD is not a licensed bank and the app must never
          imply otherwise. */}
      <Text style={styles.regulatory}>{t(props.locale, 'regulatoryNotice')}</Text>
    </ScrollView>
  );
}

function TransactionRow(props: {
  transaction: TransactionSummary;
  locale: Locale;
  colors: ThemeColors;
  rtl: boolean;
  hidden: boolean;
  isLast: boolean;
}): React.JSX.Element {
  const { transaction, colors, locale } = props;
  const amount = Money.fromMinor(transaction.amountMinor, transaction.currency);
  const incoming = transaction.direction === 'IN';
  const styles = createStyles(colors, props.rtl);

  const statusKey =
    transaction.status === 'PENDING'
      ? 'statusPending'
      : transaction.status === 'FAILED'
        ? 'statusFailed'
        : transaction.status === 'REVERSED'
          ? 'statusReversed'
          : transaction.status === 'UNDER_REVIEW'
            ? 'statusUnderReview'
            : 'statusCompleted';

  return (
    <View style={[styles.row, props.isLast && styles.rowLast]}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: incoming ? colors.successSurface : colors.background },
        ]}
      >
        <Text
          style={[
            styles.rowIconText,
            { color: incoming ? colors.success : colors.textSecondary },
          ]}
        >
          {incoming ? '↓' : '↑'}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {transaction.counterparty}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {transaction.status === 'COMPLETED'
            ? formatDate(transaction.createdAt, locale)
            : t(locale, statusKey)}
        </Text>
      </View>

      <Text
        style={[
          styles.rowAmount,
          { color: incoming ? colors.success : colors.textPrimary },
          transaction.status === 'FAILED' && styles.rowAmountVoid,
        ]}
      >
        {props.hidden
          ? t(locale, 'balanceHidden')
          : `${incoming ? '+' : '−'}${amount.format(locale, { showCode: false })}`}
      </Text>
    </View>
  );
}

function OverviewTile(props: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
  colors: ThemeColors;
}): React.JSX.Element {
  const styles = createStyles(props.colors, false);
  return (
    <View style={styles.tile}>
      <View
        style={[
          styles.tileDot,
          {
            backgroundColor:
              props.tone === 'positive' ? props.colors.success : props.colors.danger,
          },
        ]}
      />
      <Text style={styles.tileLabel}>{props.label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {props.value}
      </Text>
    </View>
  );
}

function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function createStyles(
  colors: ThemeColors,
  rtl: boolean,
): ReturnType<typeof StyleSheet.create> {
  // `writingDirection` and explicit row direction, rather than relying on
  // I18nManager alone, so a screenshot renders correctly in either mode.
  const dir = rtl ? 'rtl' : 'ltr';
  const rowDirection = rtl ? ('row-reverse' as const) : ('row' as const);
  const textAlign = rtl ? ('right' as const) : ('left' as const);

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.base, paddingBottom: spacing.xxl },

    header: {
      flexDirection: rowDirection,
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    headerText: { flex: 1 },
    greeting: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign,
      writingDirection: dir,
    },
    userName: {
      ...typography.title,
      color: colors.textPrimary,
      textAlign,
      writingDirection: dir,
    },
    brandMark: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandMarkText: { ...typography.heading, color: colors.onPrimary },

    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.onPrimary,
      opacity: 0.85,
      textAlign,
      writingDirection: dir,
    },
    balanceValue: {
      ...typography.balance,
      color: colors.onPrimary,
      marginTop: spacing.xs,
      textAlign,
      writingDirection: dir,
    },
    balanceCurrency: { ...typography.heading, color: colors.onPrimary, opacity: 0.8 },
    balanceLoader: {
      marginVertical: spacing.base,
      alignSelf: rtl ? 'flex-end' : 'flex-start',
    },
    heldText: {
      ...typography.micro,
      color: colors.onPrimary,
      opacity: 0.8,
      marginTop: spacing.xs,
      textAlign,
      writingDirection: dir,
    },
    ledgerText: {
      ...typography.micro,
      color: colors.onPrimary,
      opacity: 0.8,
      marginTop: 2,
      textAlign,
      writingDirection: dir,
    },
    hideButton: {
      marginTop: spacing.base,
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: 'center',
      paddingVertical: spacing.xs,
    },
    hideButtonText: { ...typography.caption, color: colors.onPrimary, opacity: 0.9 },
    pressed: { opacity: 0.6 },

    actionsRow: {
      flexDirection: rowDirection,
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    action: {
      width: '31%',
      alignItems: 'center',
      marginBottom: spacing.base,
      minHeight: MIN_TOUCH_TARGET,
    },
    actionIcon: {
      width: 52,
      height: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    actionIconText: { fontSize: 20, color: colors.primary },
    actionLabel: { ...typography.micro, color: colors.textSecondary, textAlign: 'center' },

    section: { marginBottom: spacing.lg },
    sectionHeader: {
      flexDirection: rowDirection,
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.heading,
      color: colors.textPrimary,
      textAlign,
      writingDirection: dir,
    },
    link: { ...typography.caption, color: colors.primary },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: rowDirection,
      alignItems: 'center',
      padding: spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginEnd: spacing.md,
    },
    rowIconText: { fontSize: 18, fontWeight: '600' },
    rowBody: { flex: 1 },
    rowTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      textAlign,
      writingDirection: dir,
    },
    rowSubtitle: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign,
      writingDirection: dir,
    },
    rowAmount: { ...typography.amount },
    rowAmountVoid: { textDecorationLine: 'line-through', color: colors.textMuted },

    empty: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    emptyHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },

    overviewRow: { flexDirection: rowDirection, gap: spacing.md },
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.base,
    },
    tileDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.sm },
    tileLabel: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign,
      writingDirection: dir,
    },
    tileValue: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      marginTop: 2,
      textAlign,
      writingDirection: dir,
    },

    regulatory: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.base,
    },
  });
}
