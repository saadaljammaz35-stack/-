import * as Application from 'expo-application';
import { router } from 'expo-router';
import { Bell, BookMarked, Clock, Database, Info, LayoutGrid, Library, Lock, MapPin, Palette, Smartphone, UserRound } from 'lucide-react-native';
import { View } from 'react-native';

import { StarMark } from '@/components/brand';
import { Screen } from '@/components/screen';
import { Group, Row, Txt } from '@/components/ui';
import { syncAvailable } from '@/features/sync';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';

export default function SettingsHome() {
  const { tr } = useI18n();
  const location = useSettings((s) => s.location);
  return (
    <Screen title={tr('الإعدادات', 'Settings')}>
      <Group title={tr('التخصيص', 'Personalise')}>
        <Row icon={Palette} title={tr('المظهر والخطوط واللغة', 'Appearance, fonts & language')} subtitle={tr('نهاري، ليلي، قراءة دافئة، الألوان', 'Light, dark, warm reading, colours')} onPress={() => router.push('/settings/appearance')} />
        <Row icon={LayoutGrid} title={tr('تخصيص الشاشة الرئيسية', 'Home screen')} onPress={() => router.push('/settings/home')} />
        <Row icon={Smartphone} title={tr('أيقونة التطبيق', 'App icon')} onPress={() => router.push('/settings/icon')} />
      </Group>
      <Group title={tr('الصلاة والتنبيهات', 'Prayer & alerts')}>
        <Row icon={MapPin} title={tr('المدينة والموقع', 'City & location')} subtitle={location?.name ?? tr('غير محدد', 'Not set')} onPress={() => router.push('/location')} />
        <Row icon={Clock} title={tr('طريقة حساب المواقيت', 'Calculation method')} onPress={() => router.push('/prayer/settings')} />
        <Row icon={Bell} title={tr('الإشعارات والأذان', 'Notifications & adhan')} onPress={() => router.push('/settings/notifications')} />
      </Group>
      <Group title={tr('بياناتك', 'Your data')}>
        {syncAvailable ? <Row icon={UserRound} title={tr('الحساب والمزامنة', 'Account & sync')} subtitle={tr('اختياري', 'Optional')} onPress={() => router.push('/settings/account')} /> : null}
        <Row icon={Database} title={tr('النسخ الاحتياطي والاستعادة', 'Backup & restore')} onPress={() => router.push('/settings/backup')} />
        <Row icon={Lock} title={tr('الخصوصية وحذف البيانات', 'Privacy & data deletion')} onPress={() => router.push('/settings/privacy')} />
        <Row icon={BookMarked} title={tr('المحفوظات والمفضلة', 'Saved & favourites')} onPress={() => router.push('/saved')} />
      </Group>
      <Group title={tr('عن التطبيق', 'About')}>
        <Row icon={Library} title={tr('المصادر والتوثيق', 'Sources & attribution')} onPress={() => router.push('/settings/sources')} />
        <Row icon={Info} title={tr('التواصل والدعم', 'Contact & support')} onPress={() => router.push('/settings/about')} />
      </Group>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 10 }}>
        <StarMark size={36} />
        <Txt variant="caption" muted>{`مع الله — ${Application.nativeApplicationVersion ?? '1.0.0'}`}</Txt>
      </View>
    </Screen>
  );
}
