import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import Constants from 'expo-constants';

import { countDays } from '../../domain/dates';
import { exportBackup, importBackup } from '../../services/backup';
import { formatBytes, imagesSize } from '../../services/files';
import { canUseBiometrics } from '../../services/lock';
import { pendingCount } from '../../services/notifications';
import { useSettings } from '../../services/settings';
import { useReceipts } from '../../state/receipts';
import { useTheme } from '../../theme';
import { confirmDestructive, ListSection, Row, StepperRow, TextFieldRow, withAlpha } from '../../ui';

export function SettingsScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const { receipts, eraseEverything, resyncReminders } = useReceipts();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [storage, setStorage] = useState(0);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [biometrics, pending] = await Promise.all([
        canUseBiometrics(),
        pendingCount().catch(() => null),
      ]);
      if (cancelled) return;

      setBiometricsAvailable(biometrics);
      setScheduled(pending);
      setStorage(imagesSize());
    })();

    return () => {
      cancelled = true;
    };
  }, [receipts.length, settings.notificationsEnabled]);

  async function toggleNotifications(enabled: boolean) {
    await update({ notificationsEnabled: enabled });
    setWorking(true);
    try {
      await resyncReminders();
      setScheduled(await pendingCount());
    } finally {
      setWorking(false);
    }
  }

  async function onExport() {
    setWorking(true);
    try {
      const { receipts: count } = await exportBackup();
      if (count === 0) Alert.alert('لا يوجد ما يُصدَّر', 'أضف فاتورة أولًا.');
    } catch (error) {
      Alert.alert('تعذّر التصدير', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    } finally {
      setWorking(false);
    }
  }

  async function onImport() {
    setWorking(true);
    try {
      const outcome = await importBackup();
      if (outcome.status === 'invalid') {
        Alert.alert('ملف غير صالح', outcome.reason);
      } else if (outcome.status === 'imported') {
        await resyncReminders();
        Alert.alert(
          'تم الاستيراد',
          outcome.skipped > 0
            ? `أُضيفت ${outcome.receipts} فاتورة، وتُخطّيت ${outcome.skipped} لبيانات ناقصة.`
            : `أُضيفت ${outcome.receipts} فاتورة.`,
        );
      }
    } catch (error) {
      Alert.alert('تعذّر الاستيراد', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    } finally {
      setWorking(false);
    }
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.groupedBackground }}
      contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
    >
      <ListSection header="بياناتك" footer="تظهر في خطابات المطالبة التي يجهّزها التطبيق. تُحفظ على جهازك فقط.">
        <TextFieldRow
          label="الاسم"
          value={settings.ownerName}
          onChangeText={(next) => void update({ ownerName: next })}
          placeholder="اسمك الكامل"
        />
        <TextFieldRow
          label="رقم الجوال"
          value={settings.ownerPhone}
          onChangeText={(next) => void update({ ownerPhone: next })}
          placeholder="05xxxxxxxx"
          keyboardType="phone-pad"
        />
      </ListSection>

      <ListSection
        header="التنبيهات"
        footer={
          settings.notificationsEnabled
            ? scheduled === null
              ? 'ينبّهك التطبيق قبل انتهاء كل مهلة.'
              : `${scheduled} تنبيه مجهّز. التنبيهات محلية على جهازك — لا تحتاج إنترنت.`
            : 'بدون تنبيهات، لن يذكّرك التطبيق قبل انتهاء المهل.'
        }
      >
        <Row
          title="تنبيهات المهل"
          icon="bell.badge"
          iconBackground={withAlpha(theme.colors.orange, 0.16)}
          iconColor={theme.colors.orange}
          accessory="none"
          trailing={
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(next) => void toggleNotifications(next)}
              disabled={working}
            />
          }
        />
      </ListSection>

      <ListSection
        header="الخصوصية"
        footer={
          biometricsAvailable
            ? 'يُطلب Face ID أو رمز الجهاز عند فتح التطبيق.'
            : 'فعّل Face ID أو رمز المرور في إعدادات الجهاز لتتمكن من قفل التطبيق.'
        }
      >
        <Row
          title="قفل التطبيق"
          icon="faceid"
          iconBackground={withAlpha(theme.colors.brand, 0.16)}
          iconColor={theme.colors.brand}
          accessory="none"
          trailing={
            <Switch
              value={settings.biometricLock}
              onValueChange={(next) => void update({ biometricLock: next })}
              disabled={!biometricsAvailable}
            />
          }
        />
      </ListSection>

      <ListSection
        header="المهل الافتراضية"
        footer="القيم المقترحة للفواتير الجديدة. سياسة الاستبدال والاسترجاع تختلف من متجر لآخر — راجع ما هو مكتوب على فاتورتك، وعدّل كل فاتورة على حدة عند الحاجة."
      >
        <StepperRow
          label="الاسترجاع"
          value={settings.defaultReturnDays}
          onChange={(next) => void update({ defaultReturnDays: next })}
          max={90}
          unit={(value) => (value === 0 ? 'غير مسموح' : countDays(value))}
        />
        <StepperRow
          label="الاستبدال"
          value={settings.defaultExchangeDays}
          onChange={(next) => void update({ defaultExchangeDays: next })}
          max={90}
          unit={(value) => (value === 0 ? 'غير مسموح' : countDays(value))}
        />
      </ListSection>

      <ListSection
        header="النسخ الاحتياطي"
        footer="النسخة تحتوي الفواتير وصورها في ملف واحد. الاستيراد يُضيف ولا يحذف، فقد تتكرر الفواتير إذا استوردت النسخة نفسها مرتين."
      >
        <Row
          title="تصدير نسخة احتياطية"
          subtitle={`${receipts.length} فاتورة · ${formatBytes(storage)} صور`}
          icon="square.and.arrow.up"
          iconBackground={withAlpha(theme.colors.green, 0.16)}
          iconColor={theme.colors.green}
          onPress={() => void onExport()}
        />
        <Row
          title="استيراد نسخة"
          icon="square.and.arrow.down"
          iconBackground={withAlpha(theme.colors.blue, 0.16)}
          iconColor={theme.colors.blue}
          onPress={() => void onImport()}
        />
      </ListSection>

      <ListSection header="عن التطبيق" footer="ضَمان يعمل بالكامل على جهازك. لا حساب، ولا سيرفر، ولا تتبّع.">
        <Row title="الإصدار" value={version} />
      </ListSection>

      <ListSection>
        <Row
          title="حذف كل البيانات"
          icon="trash"
          iconBackground={withAlpha(theme.colors.red, 0.16)}
          iconColor={theme.colors.red}
          destructive
          accessory="none"
          onPress={() =>
            confirmDestructive({
              title: 'حذف كل البيانات؟',
              message: 'تُحذف كل الفواتير والصور والتنبيهات نهائيًا. صدّر نسخة احتياطية أولًا إذا كنت تريد الاحتفاظ بها.',
              confirmLabel: 'حذف الكل',
              onConfirm: () => {
                void eraseEverything().then(() => {
                  setStorage(0);
                  setScheduled(0);
                });
              },
            })
          }
        />
      </ListSection>

      <View style={{ height: theme.space.xl }} />
    </ScrollView>
  );
}
