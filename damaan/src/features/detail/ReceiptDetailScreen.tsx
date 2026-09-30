import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { category } from '../../domain/categories';
import { countDays, formatLongDate, formatShortDate, fromISODate, humanDuration } from '../../domain/dates';
import { deadlineColor, deadlinesFor, describeDeadline, type Deadline } from '../../domain/deadlines';
import { formatMoney } from '../../domain/money';
import { asId } from '../../navigation/types';
import { imageUri } from '../../services/files';
import { useReceipts } from '../../state/receipts';
import { useTheme } from '../../theme';
import {
  Badge,
  confirmDestructive,
  ListSection,
  ProgressBar,
  Row,
  Symbol,
  Text,
  withAlpha,
} from '../../ui';

export function ReceiptDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { receipts, remove } = useReceipts();
  const receiptId = asId(useLocalSearchParams<{ id: string }>().id);
  const receipt = receipts.find((entry) => entry.id === receiptId);

  const deadlines = useMemo(() => (receipt ? deadlinesFor(receipt) : []), [receipt]);

  if (!receipt) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.groupedBackground,
        }}
      >
        <Stack.Screen options={{ title: 'الفاتورة' }} />
        <Text tone="secondary">حُذفت هذه الفاتورة.</Text>
      </View>
    );
  }

  const cat = category(receipt.categoryId);
  const actionable = deadlines.filter((deadline) => deadline.state !== 'expired' && deadline.state !== 'notApplicable');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen
        options={{
          title: receipt.item || receipt.merchant || 'الفاتورة',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/receipt/form', params: { id: receipt.id } })}
              accessibilityRole="button"
              accessibilityLabel="تعديل"
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
            >
              <Text variant="body" style={{ color: theme.colors.brand }}>
                تعديل
              </Text>
            </Pressable>
          ),
        }}
      />

      {receipt.images.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled={receipt.images.length > 1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.space.lg, gap: theme.space.md, paddingTop: theme.space.lg }}
        >
          {receipt.images.map((name) => (
            <Image
              key={name}
              source={{ uri: imageUri(name) }}
              style={{
                width: 220,
                height: 280,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.tertiaryFill,
              }}
              contentFit="cover"
              transition={150}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ alignItems: 'center', paddingTop: theme.space.xl, paddingHorizontal: theme.space.xl, gap: 6 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(theme.colors[cat.tint], theme.appearance === 'dark' ? 0.24 : 0.14),
            marginBottom: 4,
          }}
        >
          <Symbol name={cat.symbol} size={26} color={theme.colors[cat.tint]} weight="semibold" />
        </View>
        <Text variant="title2" align="center">
          {receipt.item || cat.label}
        </Text>
        <Text tone="secondary" align="center">
          {receipt.merchant}
        </Text>
        <Text variant="title3" tabular style={{ marginTop: 2 }}>
          {formatMoney(receipt.totalMinor)}
        </Text>
      </View>

      <View style={{ marginTop: theme.space.xl, gap: theme.space.md, marginHorizontal: theme.space.lg }}>
        {deadlines.map((deadline) => (
          <DeadlineCard key={deadline.kind} deadline={deadline} />
        ))}
      </View>

      {actionable.length > 0 ? (
        <ListSection header="طالِب بحقك" footer="ضَمان يجهّز لك خطابًا رسميًا بصورة الفاتورة، جاهزًا للإرسال للمتجر.">
          {actionable.map((deadline) => (
            <Row
              key={deadline.kind}
              title={
                deadline.kind === 'warranty'
                  ? 'مطالبة بتفعيل الضمان'
                  : deadline.kind === 'return'
                    ? 'طلب استرجاع المبلغ'
                    : 'طلب استبدال'
              }
              subtitle={describeDeadline(deadline, countDays)}
              icon={deadline.symbol}
              iconBackground={withAlpha(deadlineColor(deadline.state, theme.colors), 0.18)}
              iconColor={deadlineColor(deadline.state, theme.colors)}
              onPress={() =>
                router.push({ pathname: '/receipt/claim', params: { id: receipt.id, kind: deadline.kind } })
              }
            />
          ))}
        </ListSection>
      ) : null}

      <ListSection header="التفاصيل">
        <Row title="الفئة" value={cat.label} />
        <Row title="تاريخ الشراء" value={formatLongDate(fromISODate(receipt.purchaseDate))} />
        <Row title="مدة الضمان" value={humanDuration(receipt.warrantyMonths)} />
        {receipt.serial ? <Row title="الرقم التسلسلي" value={receipt.serial} /> : null}
        {receipt.notes ? <Row title="ملاحظات" subtitle={receipt.notes} /> : null}
      </ListSection>

      <ListSection>
        <Row
          title="حذف الفاتورة"
          icon="trash"
          iconBackground={withAlpha(theme.colors.red, 0.16)}
          iconColor={theme.colors.red}
          destructive
          accessory="none"
          onPress={() =>
            confirmDestructive({
              title: 'حذف الفاتورة؟',
              message: 'تُحذف الفاتورة وصورها وتنبيهاتها نهائيًا. لا يمكن التراجع.',
              confirmLabel: 'حذف',
              onConfirm: () => {
                void remove(receipt.id).then(() => router.back());
              },
            })
          }
        />
      </ListSection>
    </ScrollView>
  );
}

function DeadlineCard({ deadline }: { deadline: Deadline }) {
  const theme = useTheme();
  const accent = deadlineColor(deadline.state, theme.colors);
  const inactive = deadline.state === 'expired' || deadline.state === 'notApplicable';

  return (
    <View
      style={{
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.secondaryGroupedBackground,
        gap: theme.space.md,
        opacity: inactive ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Symbol name={deadline.symbol} size={17} color={accent} weight="semibold" />
        <Text variant="bodyEmphasized" style={{ flex: 1 }}>
          {deadline.label}
        </Text>
        <Badge label={describeDeadline(deadline, countDays)} color={accent} />
      </View>

      {deadline.endsOn ? (
        <>
          <ProgressBar value={deadline.progress} color={accent} />
          <Text variant="caption1" tone="secondary" tabular>
            {deadline.daysLeft >= 0 ? 'آخر يوم' : 'انتهت في'} {formatShortDate(deadline.endsOn)}
          </Text>
        </>
      ) : (
        <Text variant="caption1" tone="secondary">
          هذه الفاتورة غير مشمولة بهذه المهلة.
        </Text>
      )}
    </View>
  );
}
