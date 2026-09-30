import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { category } from '../../domain/categories';
import { countDays, formatShortDate } from '../../domain/dates';
import { deadlineColor, describeDeadline, headlineDeadline } from '../../domain/deadlines';
import { formatMoney } from '../../domain/money';
import type { Receipt } from '../../domain/receipt';
import { imageUri } from '../../services/files';
import { useTheme } from '../../theme';
import { Badge, ProgressBar, Symbol, Text, withAlpha } from '../../ui';

/**
 * One receipt, as a card. The headline is the nearest open window, because that
 * is the only thing on a receipt that is ever time-critical.
 */
export function ReceiptCard({ receipt, onPress }: { receipt: Receipt; onPress: () => void }) {
  const theme = useTheme();
  const cat = category(receipt.categoryId);
  const deadline = headlineDeadline(receipt);
  const accent = deadlineColor(deadline.state, theme.colors);
  const thumbnail = receipt.images[0];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${receipt.item || cat.label} من ${receipt.merchant}. ${describeDeadline(deadline, countDays)} على ${deadline.label}.`}
      style={({ pressed }) => ({
        marginHorizontal: theme.space.lg,
        marginBottom: theme.space.md,
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.secondaryGroupedBackground,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md }}>
        {thumbnail ? (
          <Image
            source={{ uri: imageUri(thumbnail) }}
            style={{ width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors.tertiaryFill }}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: withAlpha(theme.colors[cat.tint], theme.appearance === 'dark' ? 0.24 : 0.14),
            }}
          >
            <Symbol name={cat.symbol} size={21} color={theme.colors[cat.tint]} weight="semibold" />
          </View>
        )}

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyEmphasized" numberOfLines={1}>
            {receipt.item || cat.label}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {receipt.merchant} · {formatMoney(receipt.totalMinor)}
          </Text>
        </View>

        <Badge
          label={describeDeadline(deadline, countDays)}
          color={accent}
          icon={deadline.state === 'critical' ? 'exclamationmark.circle.fill' : undefined}
        />
      </View>

      {deadline.endsOn ? (
        <View style={{ marginTop: theme.space.md, gap: 6 }}>
          <ProgressBar value={deadline.progress} color={accent} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="caption1" tone="secondary">
              {deadline.label}
            </Text>
            <Text variant="caption1" tone="secondary" tabular>
              {formatShortDate(deadline.endsOn)}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
