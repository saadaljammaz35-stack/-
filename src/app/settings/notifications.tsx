import * as Linking from 'expo-linking';
import { Bell, BellRing, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Chip, SwitchRow, Txt } from '@/components/ui';
import { ensurePermission, notificationsSupported, rescheduleNotifications, scheduledCount, sendTestNotification } from '@/features/notifications';
import { useI18n } from '@/i18n';
import type { AdhanSound, Clock, NotificationSettings } from '@/lib/notification-plan';
import { PRAYER_NAMES } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const SOUNDS: { id: AdhanSound; ar: string; en: string }[] = [
  { id: 'default', ar: 'صوت التنبيه', en: 'Alert sound' },
  { id: 'silent', ar: 'صامت', en: 'Silent' },
];

function TimeChips({ value, onChange, hours }: { value: Clock; onChange: (c: Clock) => void; hours: number[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
      {hours.map((h) => (
        <Chip key={h} label={`${h % 12 === 0 ? 12 : h % 12}:${String(0).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`} active={value.hour === h && value.minute === 0} onPress={() => onChange({ hour: h, minute: 0 })} />
      ))}
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const n = useSettings((s) => s.notifications);
  const setN = useSettings((s) => s.setNotifications);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    ensurePermission(false).then(setGranted);
    scheduledCount().then(setCount);
  }, [n]);

  const patch = (p: Partial<NotificationSettings>) => setN(p);

  if (!notificationsSupported) {
    return (
      <Screen title={tr('الإشعارات', 'Notifications')}>
        <Card>
          <Txt>{tr('الإشعارات والأذان تعمل في تطبيق الجوال (iOS وAndroid).', 'Notifications and adhan work in the iOS and Android app.')}</Txt>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={tr('الإشعارات والأذان', 'Notifications & adhan')} subtitle={tr(`${count} تنبيهًا مجدولًا`, `${count} scheduled`)}>
      {granted === false ? (
        <Card tone="soft" style={{ gap: 10 }}>
          <Txt weight="semibold">{tr('التنبيهات غير مفعّلة', 'Notifications are off')}</Txt>
          <Button
            title={tr('تفعيل التنبيهات', 'Enable notifications')}
            icon={BellRing}
            onPress={async () => {
              const ok = await ensurePermission(true);
              setGranted(ok);
              if (ok) setCount(await rescheduleNotifications({ force: true }));
              else Linking.openSettings();
            }}
          />
        </Card>
      ) : null}

      <Txt weight="semibold">{tr('الأذان', 'Adhan')}</Txt>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        {(Object.keys(n.prayers) as (keyof NotificationSettings['prayers'])[]).map((id) => (
          <View key={id}>
            <SwitchRow icon={Bell} title={PRAYER_NAMES[id]} value={n.prayers[id].enabled} onChange={(v) => patch({ prayers: { ...n.prayers, [id]: { ...n.prayers[id], enabled: v } } })} />
            {n.prayers[id].enabled ? (
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
                {SOUNDS.map((s) => (
                  <Chip key={s.id} label={tr(s.ar, s.en)} active={n.prayers[id].sound === s.id || (s.id === 'default' && n.prayers[id].sound !== 'silent')} onPress={() => patch({ prayers: { ...n.prayers, [id]: { ...n.prayers[id], sound: s.id } } })} />
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <SwitchRow title={tr('تنبيه قبل الأذان', 'Alert before adhan')} value={n.preAdhan.enabled} onChange={(v) => patch({ preAdhan: { ...n.preAdhan, enabled: v } })} />
        {n.preAdhan.enabled ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
            {[5, 10, 15, 20].map((m) => (
              <Chip key={m} label={tr(`${m} دقائق`, `${m} min`)} active={n.preAdhan.minutes === m} onPress={() => patch({ preAdhan: { enabled: true, minutes: m } })} />
            ))}
          </View>
        ) : null}
      </View>

      <Txt weight="semibold">{tr('الأذكار والتذكيرات', 'Adhkar & reminders')}</Txt>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 20 }}>
        <SwitchRow title={tr('أذكار الصباح', 'Morning adhkar')} subtitle={tr(`بعد الفجر بـ${n.morningAdhkar.minutesAfterFajr} دقيقة`, `${n.morningAdhkar.minutesAfterFajr} min after Fajr`)} value={n.morningAdhkar.enabled} onChange={(v) => patch({ morningAdhkar: { ...n.morningAdhkar, enabled: v } })} />
        <SwitchRow title={tr('أذكار المساء', 'Evening adhkar')} subtitle={tr(`بعد العصر بـ${n.eveningAdhkar.minutesAfterAsr} دقيقة`, `${n.eveningAdhkar.minutesAfterAsr} min after Asr`)} value={n.eveningAdhkar.enabled} onChange={(v) => patch({ eveningAdhkar: { ...n.eveningAdhkar, enabled: v } })} />
        <SwitchRow title={tr('أذكار النوم', 'Sleep adhkar')} value={n.sleepAdhkar.enabled} onChange={(v) => patch({ sleepAdhkar: { ...n.sleepAdhkar, enabled: v } })} />
        {n.sleepAdhkar.enabled ? <TimeChips value={n.sleepAdhkar.at} hours={[21, 22, 23, 0]} onChange={(at) => patch({ sleepAdhkar: { enabled: true, at } })} /> : null}
        <SwitchRow title={tr('تذكير القرآن اليومي', 'Daily Quran reminder')} value={n.quranReminder.enabled} onChange={(v) => patch({ quranReminder: { ...n.quranReminder, enabled: v } })} />
        {n.quranReminder.enabled ? <TimeChips value={n.quranReminder.at} hours={[6, 13, 17, 20, 21]} onChange={(at) => patch({ quranReminder: { enabled: true, at } })} /> : null}
        <SwitchRow title={tr('يوم الجمعة وسورة الكهف', 'Friday & Surat al-Kahf')} value={n.fridayKahf.enabled} onChange={(v) => patch({ fridayKahf: { ...n.fridayKahf, enabled: v } })} />
        <SwitchRow title={tr('تذكير صيام التطوع', 'Voluntary fasting reminder')} subtitle={tr('الاثنين والخميس والأيام البيض وعرفة وعاشوراء (مساء اليوم السابق)', 'Mon/Thu, white days, Arafah, Ashura — the evening before')} value={n.fasting.enabled} onChange={(v) => patch({ fasting: { ...n.fasting, enabled: v } })} />
      </View>
      <Txt variant="caption" muted>
        {tr('تذكير الختمة يُضبط من صفحة كل ختمة.', 'Khatma reminders are set on each khatma.')}
      </Txt>

      <Button title={tr('إرسال إشعار تجريبي', 'Send a test notification')} icon={Send} tone="soft" onPress={sendTestNotification} />
      <Txt variant="caption" muted>
        {Platform.OS === 'ios'
          ? tr('يحدّ نظام iOS عدد التنبيهات المجدولة بـ64؛ لذلك يجدول التطبيق الأيام القادمة ويحدّثها تلقائيًا عند فتحه وفي الخلفية. صوت الإشعار في iOS لا يتجاوز 30 ثانية.', 'iOS allows 64 pending notifications, so the app schedules the coming days and refreshes them on launch and in the background.')
          : tr('لدقة مواعيد الأذان على Android 12+ اسمح للتطبيق بـ«المنبهات والتذكيرات» من إعدادات النظام إن طُلب منك.', 'For exact adhan times on Android 12+, allow “Alarms & reminders” if asked.')}
      </Txt>
    </Screen>
  );
}
