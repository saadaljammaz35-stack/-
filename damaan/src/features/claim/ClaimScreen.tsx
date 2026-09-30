import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { countDays } from '../../domain/dates';
import { deadlinesFor, describeDeadline } from '../../domain/deadlines';
import { asClaimKind, asId } from '../../navigation/types';
import { claimMessage, claimReference, shareClaimPdf, type ClaimKind } from '../../services/claim';
import { useSettings } from '../../services/settings';
import { useReceipts } from '../../state/receipts';
import { useTheme } from '../../theme';
import { Badge, Button, ButtonStack, ListSection, Row, Text, TextFieldRow } from '../../ui';

const TITLES: Record<ClaimKind, string> = {
  warranty: 'مطالبة بالضمان',
  return: 'طلب استرجاع',
  exchange: 'طلب استبدال',
};

/** Prompts that get people to write the one thing a shop actually needs. */
const PLACEHOLDERS: Record<ClaimKind, string> = {
  warranty: 'مثال: الشاشة توقفت عن الاستجابة بعد 4 أشهر من الاستخدام العادي، بدون أي سقوط أو ماء.',
  return: 'مثال: المنتج لا يطابق المواصفات المعروضة، ولم يُستخدم وما زال بغلافه الأصلي.',
  exchange: 'مثال: وصل المنتج بلون مختلف عن المطلوب، والعلبة لم تُفتح.',
};

export function ClaimScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { receipts } = useReceipts();

  const params = useLocalSearchParams<{ id: string; kind: string }>();
  const kind = asClaimKind(params.kind);
  const receipt = receipts.find((entry) => entry.id === asId(params.id));

  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const deadline = useMemo(
    () => (receipt ? deadlinesFor(receipt).find((entry) => entry.kind === kind) : undefined),
    [receipt, kind],
  );

  const message = useMemo(
    () => (receipt ? claimMessage({ receipt, kind, problem, settings }) : ''),
    [receipt, kind, problem, settings],
  );

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
        <Stack.Screen options={{ title: TITLES[kind] }} />
        <Text tone="secondary">حُذفت هذه الفاتورة.</Text>
      </View>
    );
  }

  async function sharePdf() {
    setBusy(true);
    try {
      await shareClaimPdf({ receipt: receipt!, kind, problem, settings });
    } catch (error) {
      Alert.alert('تعذّر إنشاء الملف', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function shareText() {
    try {
      await Share.share({ message });
    } catch {
      // Dismissing the share sheet is not an error worth surfacing.
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }}>
      <Stack.Screen options={{ title: TITLES[kind] }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: theme.space.xl }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.space.sm,
            marginHorizontal: theme.space.lg,
            marginTop: theme.space.lg,
          }}
        >
          <Badge label={`المرجع ${claimReference(receipt)}`} color={theme.colors.brand} icon="number" />
          {deadline ? (
            <Badge label={describeDeadline(deadline, countDays)} color={theme.colors.orange} icon="clock" />
          ) : null}
        </View>

        <ListSection
          header="وش المشكلة؟"
          footer="كن محددًا: متى بدأت المشكلة، وهل فيه سوء استخدام. الوصف الواضح يختصر النقاش مع المتجر."
        >
          <TextFieldRow
            label="الوصف"
            value={problem}
            onChangeText={setProblem}
            placeholder={PLACEHOLDERS[kind]}
            multiline
            maxLength={800}
          />
        </ListSection>

        {settings.ownerName.trim() ? null : (
          <ListSection footer="اسمك ورقمك يظهران في الخطاب كمقدّم الطلب.">
            <Row
              title="أضف اسمك ورقم جوالك"
              subtitle="حتى يعرف المتجر بمن يتواصل"
              icon="person.crop.circle"
              onPress={() => router.push('/settings')}
            />
          </ListSection>
        )}

        <ListSection header="معاينة الخطاب">
          <View style={{ padding: theme.space.lg }}>
            <Text variant="footnote" style={{ lineHeight: 22 }}>
              {message}
            </Text>
          </View>
        </ListSection>
      </ScrollView>

      <View
        style={{
          paddingTop: theme.space.md,
          paddingBottom: theme.space.xxl,
          borderTopWidth: 0.5,
          borderTopColor: theme.colors.separator,
          backgroundColor: theme.colors.secondaryGroupedBackground,
        }}
      >
        {busy ? (
          <View style={{ alignItems: 'center', paddingVertical: theme.space.md }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ButtonStack>
            <Button title="مشاركة الخطاب PDF" icon="doc.richtext" onPress={() => void sharePdf()} full />
            <Button title="إرسال كرسالة نصية" icon="paperplane" kind="tinted" onPress={() => void shareText()} full />
          </ButtonStack>
        )}
      </View>
    </View>
  );
}
