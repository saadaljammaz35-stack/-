import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { CATEGORIES, category, type CategoryId } from '../../domain/categories';
import { countDays, formatLongDate, fromISODate, humanDuration, toISODate } from '../../domain/dates';
import { formatMoney, parseAmountToMinor } from '../../domain/money';
import type { ReceiptDraft } from '../../domain/receipt';
import { deleteImage, importImage, imageUri } from '../../services/files';
import { isRecognitionAvailable, readReceipt } from '../../services/ocr';
import { useSettings } from '../../services/settings';
import { useReceipts } from '../../state/receipts';
import { useTheme } from '../../theme';
import {
  Badge,
  ChoiceRow,
  DateFieldRow,
  ListSection,
  showActionSheet,
  StepperRow,
  Symbol,
  Text,
  TextFieldRow,
  withAlpha,
} from '../../ui';

export function ReceiptFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { receipts, create, save } = useReceipts();

  const editingId = useLocalSearchParams<{ id?: string }>().id;
  const existing = useMemo(
    () => (editingId ? receipts.find((entry) => entry.id === editingId) : undefined),
    [editingId, receipts],
  );

  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [item, setItem] = useState(existing?.item ?? '');
  const [amount, setAmount] = useState(
    existing ? formatMoney(existing.totalMinor, { withSymbol: false }) : '',
  );
  const [purchaseDate, setPurchaseDate] = useState(
    existing ? fromISODate(existing.purchaseDate) : new Date(),
  );
  const [categoryId, setCategoryId] = useState<CategoryId>(existing?.categoryId ?? 'phones');
  const [warrantyMonths, setWarrantyMonths] = useState(
    existing?.warrantyMonths ?? category('phones').defaultWarrantyMonths,
  );
  const [returnDays, setReturnDays] = useState(existing?.returnDays ?? settings.defaultReturnDays);
  const [exchangeDays, setExchangeDays] = useState(existing?.exchangeDays ?? settings.defaultExchangeDays);
  const [serial, setSerial] = useState(existing?.serial ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);

  const [reading, setReading] = useState(false);
  const [readingNote, setReadingNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalMinor = parseAmountToMinor(amount);
  const valid = merchant.trim().length > 0 && totalMinor !== null && totalMinor > 0;

  /** Changing the category re-suggests its typical warranty, unless edited. */
  function chooseCategory() {
    showActionSheet(
      { title: 'فئة المنتج', options: CATEGORIES.map((entry) => ({ label: entry.label })) },
      (index) => {
        const next = CATEGORIES[index]!;
        setCategoryId(next.id);
        if (warrantyMonths === category(categoryId).defaultWarrantyMonths) {
          setWarrantyMonths(next.defaultWarrantyMonths);
        }
      },
    );
  }

  async function attachImage(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'نحتاج إذنك',
        source === 'camera'
          ? 'فعّل إذن الكاميرا من إعدادات النظام لتصوير الفاتورة.'
          : 'فعّل إذن الصور من إعدادات النظام لاختيار صورة الفاتورة.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });

    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    const name = await importImage(asset.uri);
    setImages((previous) => [...previous, name]);

    // Only the first image is worth reading — it is the one with the totals.
    if (images.length === 0) await tryRecognize(asset.uri);
  }

  async function tryRecognize(uri: string) {
    if (!isRecognitionAvailable()) return;

    setReading(true);
    setReadingNote(null);
    const outcome = await readReceipt(uri);
    setReading(false);

    if (outcome.status !== 'recognized') {
      setReadingNote(outcome.status === 'failed' ? outcome.reason : null);
      return;
    }

    const filled: string[] = [];
    if (outcome.parsed.merchant && !merchant.trim()) {
      setMerchant(outcome.parsed.merchant);
      filled.push('المتجر');
    }
    if (outcome.parsed.totalMinor && !amount.trim()) {
      setAmount(formatMoney(outcome.parsed.totalMinor, { withSymbol: false }));
      filled.push('المبلغ');
    }
    if (outcome.parsed.purchaseDate) {
      setPurchaseDate(fromISODate(outcome.parsed.purchaseDate));
      filled.push('التاريخ');
    }

    setReadingNote(
      filled.length > 0 ? `قرأت من الصورة: ${filled.join('، ')} — راجعها قبل الحفظ.` : 'ما قدرت أقرأ بيانات واضحة من الصورة.',
    );
  }

  function removeImage(name: string) {
    setImages((previous) => previous.filter((entry) => entry !== name));
    // An image attached during this session and then removed is already orphaned.
    if (!existing?.images.includes(name)) deleteImage(name);
  }

  async function onSave() {
    if (!valid || totalMinor === null || saving) return;

    const draft: ReceiptDraft = {
      merchant: merchant.trim(),
      item: item.trim(),
      categoryId,
      totalMinor,
      purchaseDate: toISODate(purchaseDate),
      warrantyMonths,
      returnDays,
      exchangeDays,
      serial: serial.trim(),
      notes: notes.trim(),
      images,
    };

    setSaving(true);
    try {
      if (existing) {
        await save(existing.id, draft);
        router.back();
      } else {
        const created = await create(draft);
        // Replace, so dismissing the new receipt does not land back on the form.
        router.replace(`/receipt/${created.id}`);
      }
    } catch (error) {
      setSaving(false);
      Alert.alert('تعذّر الحفظ', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: existing ? 'تعديل الفاتورة' : 'فاتورة جديدة',
          headerRight: () => (
            <Pressable
              onPress={() => void onSave()}
              disabled={!valid || saving}
              accessibilityRole="button"
              accessibilityLabel="حفظ"
              hitSlop={10}
              style={{ opacity: !valid || saving ? 0.35 : 1, padding: 4 }}
            >
              {saving ? (
                <ActivityIndicator />
              ) : (
                <Text variant="bodyEmphasized" style={{ color: theme.colors.brand }}>
                  حفظ
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ImageStrip
        images={images}
        reading={reading}
        note={readingNote}
        onAdd={() =>
          showActionSheet(
            { title: 'صورة الفاتورة', options: [{ label: 'التقاط صورة' }, { label: 'اختيار من الصور' }] },
            (index) => void attachImage(index === 0 ? 'camera' : 'library'),
          )
        }
        onRemove={removeImage}
      />

      <ListSection header="المشترى">
        <TextFieldRow label="المتجر" value={merchant} onChangeText={setMerchant} placeholder="مثال: مكتبة جرير" />
        <TextFieldRow label="المنتج" value={item} onChangeText={setItem} placeholder="مثال: iPhone 17 Pro" />
        <TextFieldRow
          label="المبلغ"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <ChoiceRow label="الفئة" value={category(categoryId).label} onPress={chooseCategory} />
        <DateFieldRow
          label="تاريخ الشراء"
          value={purchaseDate}
          onChange={setPurchaseDate}
          maximumDate={new Date()}
          formatted={formatLongDate(purchaseDate)}
        />
      </ListSection>

      <ListSection
        header="المهل"
        footer="مدة الضمان تُقترح حسب الفئة، ومهل الاسترجاع والاستبدال تختلف من متجر لآخر — عدّلها حسب سياسة متجرك المكتوبة على الفاتورة."
      >
        <StepperRow
          label="الضمان"
          value={warrantyMonths}
          onChange={setWarrantyMonths}
          step={6}
          max={120}
          unit={humanDuration}
        />
        <StepperRow
          label="الاسترجاع"
          value={returnDays}
          onChange={setReturnDays}
          max={90}
          unit={(value) => (value === 0 ? 'غير مسموح' : countDays(value))}
        />
        <StepperRow
          label="الاستبدال"
          value={exchangeDays}
          onChange={setExchangeDays}
          max={90}
          unit={(value) => (value === 0 ? 'غير مسموح' : countDays(value))}
        />
      </ListSection>

      <ListSection header="تفاصيل إضافية">
        <TextFieldRow label="الرقم التسلسلي" value={serial} onChangeText={setSerial} placeholder="اختياري" />
        <TextFieldRow label="ملاحظات" value={notes} onChangeText={setNotes} placeholder="اختياري" multiline maxLength={500} />
      </ListSection>

      {!valid ? (
        <Text variant="footnote" tone="secondary" align="center" style={{ marginTop: theme.space.xl, marginHorizontal: theme.space.xxl }}>
          اسم المتجر والمبلغ مطلوبان للحفظ.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function ImageStrip({
  images,
  reading,
  note,
  onAdd,
  onRemove,
}: {
  images: string[];
  reading: boolean;
  note: string | null;
  onAdd: () => void;
  onRemove: (name: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ marginTop: theme.space.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, gap: theme.space.md }}
      >
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="إضافة صورة للفاتورة"
          style={({ pressed }) => ({
            width: 104,
            height: 132,
            borderRadius: theme.radius.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: theme.colors.gray3,
            backgroundColor: withAlpha(theme.colors.brand, theme.appearance === 'dark' ? 0.12 : 0.06),
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Symbol name="camera.viewfinder" size={26} color={theme.colors.brand} />
          <Text variant="caption1" style={{ color: theme.colors.brand, fontWeight: '600' }}>
            صوّر الفاتورة
          </Text>
        </Pressable>

        {images.map((name) => (
          <View key={name}>
            <Image
              source={{ uri: imageUri(name) }}
              style={{
                width: 104,
                height: 132,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.tertiaryFill,
              }}
              contentFit="cover"
              transition={150}
            />
            <Pressable
              onPress={() => onRemove(name)}
              accessibilityRole="button"
              accessibilityLabel="حذف الصورة"
              hitSlop={8}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.label,
              }}
            >
              <Symbol name="xmark" size={11} color={theme.colors.background} weight="bold" />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {reading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.space.md, marginHorizontal: theme.space.xl }}>
          <ActivityIndicator />
          <Text variant="footnote" tone="secondary">
            أقرأ الفاتورة…
          </Text>
        </View>
      ) : note ? (
        <View style={{ marginTop: theme.space.md, marginHorizontal: theme.space.xl }}>
          <Badge label={note} color={theme.colors.brand} icon="sparkles" />
        </View>
      ) : null}
    </View>
  );
}
