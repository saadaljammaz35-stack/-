/**
 * Identity verification.
 *
 * The screen leads with *why*: verification raises the wallet's limits. A
 * document-upload flow that does not explain what the customer gets is a flow
 * people abandon, and an abandoned verification means a TIER_0 wallet that can
 * hold nothing — so the copy is a product decision, not decoration.
 *
 * Completeness is computed by `checkDocuments` from `@nabd/compliance`, the same
 * function the API uses to decide whether an application may be submitted. The
 * screen cannot disagree with the server about what is missing.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  type KycDocumentType,
  type KycLevel,
  type SubmittedDocument,
  checkDocuments,
  requiredDocuments,
} from '@nabd/compliance';
import type { KycStatus } from '@nabd/shared';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '@nabd/ui';

import {
  Card,
  ErrorText,
  PrimaryButton,
  ScreenTitle,
  StatusPill,
  sharedStyles,
  useTheme,
} from '../components/primitives.js';
import { isRtl, t, type Locale, type StringKey } from '../i18n/strings.js';

export interface KycScreenProps {
  locale: Locale;
  status: KycStatus;
  level: KycLevel;
  documents: SubmittedDocument[];
  rejectionReason?: string;
  onUpload: (type: KycDocumentType) => Promise<void>;
  onSubmit: () => Promise<void>;
}

const LABELS: Record<KycDocumentType, StringKey> = {
  ID_FRONT: 'kycIdFront',
  ID_BACK: 'kycIdBack',
  SELFIE: 'kycSelfie',
  PROOF_OF_ADDRESS: 'kycProofAddress',
  OTHER: 'kycUpload',
};

export function KycScreen(props: KycScreenProps): React.JSX.Element {
  const colors = useTheme();
  const rtl = isRtl(props.locale);
  const [busyType, setBusyType] = useState<KycDocumentType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The same function the server uses — the screen cannot disagree with it
  // about what is still missing.
  const check = useMemo(
    () => checkDocuments(props.level, props.documents),
    [props.level, props.documents],
  );

  const uploaded = useMemo(
    () => new Set(props.documents.map((d) => d.type)),
    [props.documents],
  );

  const upload = useCallback(
    async (type: KycDocumentType) => {
      setBusyType(type);
      setError(null);
      try {
        await props.onUpload(type);
      } catch (e) {
        setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
      } finally {
        setBusyType(null);
      }
    },
    [props],
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await props.onSubmit();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(props.locale, 'errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }, [props]);

  // ── terminal states get their own screen, not a disabled form ──
  if (props.status === 'UNDER_REVIEW') {
    return (
      <View
        style={[
          sharedStyles.screen,
          sharedStyles.centered,
          { backgroundColor: colors.background, padding: spacing.lg },
        ]}
      >
        <Text style={{ fontSize: 44 }}>⏳</Text>
        <Text
          style={{
            ...typography.heading,
            color: colors.textPrimary,
            marginTop: spacing.base,
            textAlign: 'center',
          }}
        >
          {t(props.locale, 'kycUnderReview')}
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: spacing.sm,
            textAlign: 'center',
          }}
        >
          {t(props.locale, 'kycUnderReviewHint')}
        </Text>
      </View>
    );
  }

  if (props.status === 'VERIFIED') {
    return (
      <View
        style={[
          sharedStyles.screen,
          sharedStyles.centered,
          { backgroundColor: colors.background, padding: spacing.lg },
        ]}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            backgroundColor: colors.successSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 34, color: colors.success }}>✓</Text>
        </View>
        <Text
          style={{
            ...typography.heading,
            color: colors.textPrimary,
            marginTop: spacing.base,
          }}
        >
          {t(props.locale, 'kycVerified')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[sharedStyles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={sharedStyles.content}
    >
      <ScreenTitle
        title={t(props.locale, 'kycTitle')}
        // Leading with the benefit, not the paperwork.
        subtitle={t(props.locale, 'kycWhy')}
        rtl={rtl}
      />

      {props.status === 'REJECTED' && props.rejectionReason !== undefined && (
        <Card>
          <StatusPill label={t(props.locale, 'kycRejected')} tone="danger" />
          <Text
            style={{
              ...typography.body,
              color: colors.textPrimary,
              marginTop: spacing.sm,
              textAlign: rtl ? 'right' : 'left',
              writingDirection: rtl ? 'rtl' : 'ltr',
            }}
          >
            {props.rejectionReason}
          </Text>
        </Card>
      )}

      {requiredDocuments(props.level).map((type) => {
        const done = uploaded.has(type);
        return (
          <Pressable
            key={type}
            onPress={() => void upload(type)}
            disabled={busyType !== null}
            accessibilityRole="button"
            accessibilityState={{ checked: done }}
            style={({ pressed }) => [
              {
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: done ? colors.success : colors.border,
                padding: spacing.base,
                minHeight: MIN_TOUCH_TARGET + 12,
                marginBottom: spacing.md,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.bodyStrong,
                  color: colors.textPrimary,
                  textAlign: rtl ? 'right' : 'left',
                  writingDirection: rtl ? 'rtl' : 'ltr',
                }}
              >
                {t(props.locale, LABELS[type])}
              </Text>
              <Text
                style={{
                  ...typography.micro,
                  color: done ? colors.success : colors.textMuted,
                  textAlign: rtl ? 'right' : 'left',
                  marginTop: 2,
                }}
              >
                {t(props.locale, done ? 'kycUploaded' : 'kycMissing')}
              </Text>
            </View>

            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: done ? colors.success : colors.border,
                backgroundColor: done ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done && <Text style={{ color: colors.onPrimary, fontSize: 15 }}>✓</Text>}
            </View>
          </Pressable>
        );
      })}

      {error !== null && <ErrorText message={error} rtl={rtl} />}

      <PrimaryButton
        label={t(props.locale, 'kycSubmit')}
        onPress={submit}
        disabled={!check.complete}
        busy={submitting}
      />
    </ScrollView>
  );
}
