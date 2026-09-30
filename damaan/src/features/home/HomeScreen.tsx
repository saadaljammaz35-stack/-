import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { deadlinesFor, receiptState, type ReceiptState } from '../../domain/deadlines';
import { formatMoneyRounded } from '../../domain/money';
import type { Receipt } from '../../domain/receipt';
import { useReceipts } from '../../state/receipts';
import { useTheme } from '../../theme';
import { Symbol, Text } from '../../ui';
import { ReceiptCard } from './ReceiptCard';

const SECTION_TITLES: Record<ReceiptState, string> = {
  needsAttention: 'يحتاج انتباهك',
  protected: 'تحت الضمان',
  expired: 'انتهت مهلها',
};

const SECTION_ORDER: ReceiptState[] = ['needsAttention', 'protected', 'expired'];

export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { receipts, loading, error, reload } = useReceipts();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return receipts;

    return receipts.filter((receipt) =>
      [receipt.merchant, receipt.item, receipt.serial, receipt.notes].join(' ').toLowerCase().includes(needle),
    );
  }, [receipts, query]);

  const sections = useMemo(() => {
    const buckets = new Map<ReceiptState, Receipt[]>(SECTION_ORDER.map((state) => [state, []]));
    for (const receipt of filtered) buckets.get(receiptState(receipt))!.push(receipt);

    return SECTION_ORDER.filter((state) => (buckets.get(state) ?? []).length > 0).map((state) => ({
      title: SECTION_TITLES[state],
      data: buckets.get(state)!,
    }));
  }, [filtered]);

  const summary = useMemo(() => {
    let protectedMinor = 0;
    let closingSoon = 0;

    for (const receipt of receipts) {
      const deadlines = deadlinesFor(receipt);
      const warranty = deadlines.find((deadline) => deadline.kind === 'warranty');
      if (warranty && warranty.state !== 'expired' && warranty.state !== 'notApplicable') {
        protectedMinor += receipt.totalMinor;
      }
      if (deadlines.some((deadline) => deadline.state === 'critical' || deadline.state === 'soon')) {
        closingSoon += 1;
      }
    }

    return { protectedMinor, closingSoon, total: receipts.length };
  }, [receipts]);

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <HeaderButton symbol="plus" label="إضافة فاتورة" onPress={() => router.push('/receipt/form')} />
        ),
        headerLeft: () => (
          <HeaderButton symbol="gearshape" label="الإعدادات" onPress={() => router.push('/settings')} />
        ),
        headerSearchBarOptions: {
          placeholder: 'ابحث بالمتجر أو المنتج',
          onChangeText: (event) => setQuery(event.nativeEvent.text),
          hideWhenScrolling: true,
        },
      }}
    />
  );

  if (!loading && receipts.length === 0) {
    return (
      <>
        {header}
        <EmptyState onAdd={() => router.push('/receipt/form')} error={error} />
      </>
    );
  }

  return (
    <>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(receipt) => receipt.id}
        style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void reload().finally(() => setRefreshing(false));
            }}
          />
        }
        ListHeaderComponent={
          query.trim() ? null : (
            <SummaryStrip
              protectedMinor={summary.protectedMinor}
              closingSoon={summary.closingSoon}
              total={summary.total}
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingHorizontal: theme.space.lg * 2,
              paddingTop: theme.space.xl,
              paddingBottom: theme.space.sm,
              backgroundColor: theme.colors.groupedBackground,
            }}
          >
            <Text variant="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ReceiptCard receipt={item} onPress={() => router.push(`/receipt/${item.id}`)} />
        )}
        ListEmptyComponent={
          query.trim() ? (
            <View style={{ padding: theme.space.xxxl, alignItems: 'center' }}>
              <Text tone="secondary">لا نتائج لـ «{query.trim()}»</Text>
            </View>
          ) : null
        }
      />
    </>
  );
}

function SummaryStrip({
  protectedMinor,
  closingSoon,
  total,
}: {
  protectedMinor: number;
  closingSoon: number;
  total: number;
}) {
  const theme = useTheme();

  const tiles = [
    { label: 'محمي بالضمان', value: formatMoneyRounded(protectedMinor), tint: theme.colors.green },
    { label: 'ينتهي قريبًا', value: String(closingSoon), tint: closingSoon > 0 ? theme.colors.orange : theme.colors.gray },
    { label: 'فاتورة محفوظة', value: String(total), tint: theme.colors.brand },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: theme.space.lg,
        marginTop: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.secondaryGroupedBackground,
        overflow: 'hidden',
      }}
    >
      {tiles.map((tile, index) => (
        <View key={tile.label} style={{ flex: 1, flexDirection: 'row' }}>
          {index > 0 ? <View style={{ width: 1, backgroundColor: theme.colors.separator }} /> : null}
          <View
            style={{
              flex: 1,
              paddingVertical: theme.space.lg,
              paddingHorizontal: theme.space.sm,
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Text variant="title3" tabular style={{ color: tile.tint }} numberOfLines={1} adjustsFontSizeToFit>
              {tile.value}
            </Text>
            <Text variant="caption1" tone="secondary" align="center" numberOfLines={2}>
              {tile.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ onAdd, error }: { onAdd: () => void; error: string | null }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.groupedBackground,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space.xxl,
        gap: theme.space.md,
      }}
    >
      <Symbol name="doc.text.magnifyingglass" size={56} color={theme.colors.gray3} />
      <Text variant="title3" align="center">
        خزنتك فاضية
      </Text>
      <Text tone="secondary" align="center" style={{ maxWidth: 300 }}>
        أضف أول فاتورة، وضَمان يتابع لك مهلة الاسترجاع والاستبدال والضمان — وينبّهك قبل ما تنتهي.
      </Text>
      {error ? (
        <Text variant="footnote" tone="destructive" align="center">
          {error}
        </Text>
      ) : null}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: theme.space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.md,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.brand,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Symbol name="plus" size={16} color="#FFFFFF" weight="semibold" />
        <Text variant="bodyEmphasized" style={{ color: '#FFFFFF' }}>
          أضف فاتورة
        </Text>
      </Pressable>
    </View>
  );
}

function HeaderButton({
  symbol,
  label,
  onPress,
}: {
  symbol: 'plus' | 'gearshape';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Symbol name={symbol} size={20} color={theme.colors.brand} weight="semibold" />
    </Pressable>
  );
}
