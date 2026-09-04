/**
 * Cards.
 *
 * The card spends directly from the wallet — there is no separate card balance
 * — and the screen says so, because a customer who thinks otherwise will try to
 * "load" the card and then contact support. That one line of copy prevents a
 * whole category of ticket.
 *
 * Freeze is the most important control here and is therefore the most
 * prominent: a customer who has mislaid their card needs to stop it in one tap,
 * from the list, without hunting through a settings screen.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Money, type CurrencyCode } from '@nabd/shared';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '@nabd/ui';

import {
  Card as Surface,
  DetailRow,
  ErrorText,
  PrimaryButton,
  ScreenTitle,
  StatusPill,
  sharedStyles,
  useTheme,
} from '../components/primitives.js';
import { isRtl, t, type Locale } from '../i18n/strings.js';

export type CardStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'FROZEN'
  | 'BLOCKED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface WalletCard {
  id: string;
  type: 'VIRTUAL' | 'PHYSICAL';
  status: CardStatus;
  brand: string;
  /** Last four digits only — NABD never holds a PAN. */
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  dailyLimitMinor?: string;
}

export interface CardsScreenProps {
  locale: Locale;
  currency: CurrencyCode;
  cards: WalletCard[];
  walletBalanceMinor: string;
  onFreeze: (cardId: string) => Promise<void>;
  onUnfreeze: (cardId: string) => Promise<void>;
  onIssue?: (type: 'VIRTUAL' | 'PHYSICAL') => Promise<void>;
  /** False when the wallet's tier does not yet permit card issuance. */
  canIssueCard?: boolean;
}

export function CardsScreen(props: CardsScreenProps): React.JSX.Element {
  const colors = useTheme();
  const rtl = isRtl(props.locale);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance = Money.fromMinor(props.walletBalanceMinor, props.currency);

  const toggleFreeze = useCallback(
    async (card: WalletCard) => {
      setBusyCardId(card.id);
      setError(null);
      try {
        if (card.status === 'FROZEN') await props.onUnfreeze(card.id);
        else await props.onFreeze(card.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
      } finally {
        setBusyCardId(null);
      }
    },
    [props],
  );

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={sharedStyles.content}
    >
      <ScreenTitle
        title={t(props.locale, 'cardsTitle')}
        // The line that prevents the "my money is stuck on the card" ticket.
        subtitle={t(props.locale, 'cardSpendsFromWallet')}
        rtl={rtl}
      />

      {props.cards.length === 0 ? (
        <Surface>
          <View style={[sharedStyles.centered, { paddingVertical: spacing.xl }]}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              {t(props.locale, 'noTransactions')}
            </Text>
          </View>
        </Surface>
      ) : (
        props.cards.map((card) => (
          <View key={card.id} style={{ marginBottom: spacing.lg }}>
            {/* the card face */}
            <View
              style={{
                backgroundColor:
                  card.status === 'ACTIVE' ? colors.primary : colors.surfaceRaised,
                borderRadius: radius.xl,
                padding: spacing.lg,
                minHeight: 180,
                justifyContent: 'space-between',
                opacity: card.status === 'ACTIVE' ? 1 : 0.7,
              }}
            >
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color:
                      card.status === 'ACTIVE' ? colors.onPrimary : colors.textSecondary,
                  }}
                >
                  {t(
                    props.locale,
                    card.type === 'VIRTUAL' ? 'cardVirtual' : 'cardPhysical',
                  )}
                </Text>
                <Text
                  style={{
                    ...typography.bodyStrong,
                    color:
                      card.status === 'ACTIVE' ? colors.onPrimary : colors.textSecondary,
                  }}
                >
                  {t(props.locale, 'appName')}
                </Text>
              </View>

              <View>
                {/* Only ever the last four. The full number lives with the
                    issuer and never enters NABD's systems. */}
                <Text
                  style={{
                    ...typography.title,
                    color:
                      card.status === 'ACTIVE' ? colors.onPrimary : colors.textSecondary,
                    letterSpacing: 3,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  •••• •••• •••• {card.last4}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color:
                      card.status === 'ACTIVE' ? colors.onPrimary : colors.textSecondary,
                    opacity: 0.85,
                    marginTop: spacing.xs,
                  }}
                >
                  {String(card.expiryMonth).padStart(2, '0')}/
                  {String(card.expiryYear).slice(-2)}
                  {'   ·   '}
                  {balance.format(props.locale)}
                </Text>
              </View>
            </View>

            {/* status and the freeze control, side by side and reachable */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: spacing.md,
              }}
            >
              <StatusPill
                label={t(
                  props.locale,
                  card.status === 'FROZEN'
                    ? 'cardFrozen'
                    : card.status === 'ACTIVE'
                      ? 'cardActive'
                      : 'cardBlocked',
                )}
                tone={
                  card.status === 'ACTIVE'
                    ? 'success'
                    : card.status === 'FROZEN'
                      ? 'warning'
                      : 'danger'
                }
              />

              {/* Blocked and cancelled cards cannot be unfrozen — that is a
                  terminal state and offering the control would be a lie. */}
              {(card.status === 'ACTIVE' || card.status === 'FROZEN') && (
                <Pressable
                  onPress={() => void toggleFreeze(card)}
                  disabled={busyCardId === card.id}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      minHeight: MIN_TOUCH_TARGET,
                      paddingHorizontal: spacing.base,
                      justifyContent: 'center',
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor:
                        card.status === 'FROZEN' ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: card.status === 'FROZEN' ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {t(
                      props.locale,
                      card.status === 'FROZEN' ? 'unfreezeCard' : 'freezeCard',
                    )}
                  </Text>
                </Pressable>
              )}
            </View>

            {card.dailyLimitMinor !== undefined && (
              <Surface padded={false}>
                <DetailRow
                  label={t(props.locale, 'cardLimits')}
                  value={Money.fromMinor(card.dailyLimitMinor, props.currency).format(
                    props.locale,
                  )}
                  rtl={rtl}
                  monospace
                  last
                />
              </Surface>
            )}
          </View>
        ))
      )}

      {error !== null && <ErrorText message={error} rtl={rtl} />}

      {props.onIssue !== undefined && (
        <PrimaryButton
          label={t(props.locale, 'newCard')}
          onPress={() => void props.onIssue?.('VIRTUAL')}
          // Card issuance is gated on the wallet tier, so the button reflects
          // the real rule rather than failing after a round trip.
          disabled={props.canIssueCard === false}
        />
      )}

      {props.canIssueCard === false && (
        <Text
          style={{
            ...typography.micro,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: spacing.sm,
          }}
        >
          {t(props.locale, 'upgradeToRaise')}
        </Text>
      )}
    </ScrollView>
  );
}
