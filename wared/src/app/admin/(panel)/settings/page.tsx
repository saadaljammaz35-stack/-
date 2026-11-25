import { EntityForm, type FieldConfig } from '@/components/admin/EntityForm';
import { AdminHeader } from '@/components/admin/ui';
import { saveSettings } from '@/lib/admin/actions/manage';
import { requireStaff } from '@/lib/admin/auth';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'إعدادات الموقع' };

const FIELDS: FieldConfig[] = [
  { type: 'section', title: 'عام' },
  { type: 'text', name: 'general.site_name', label: 'اسم الموقع' },
  { type: 'text', name: 'general.site_name_en', label: 'الاسم بالإنجليزية', dir: 'ltr' },
  { type: 'text', name: 'general.tagline', label: 'الشعار اللفظي' },
  { type: 'text', name: 'general.tagline_en', label: 'الشعار بالإنجليزية', dir: 'ltr' },
  { type: 'email', name: 'general.contact_email', label: 'بريد التواصل العام', hint: 'يظهر في صفحة التواصل وفي خلاصة RSS (مطلوب لآبل بودكاست).' },
  { type: 'text', name: 'general.announcement', label: 'إعلان قصير (اختياري)' },
  { type: 'section', title: 'منصات الاستماع', description: 'تظهر الروابط المضافة فقط. لا تضف رابطًا قبل أن يكون البودكاست منشورًا فعلًا على المنصة.' },
  { type: 'url', name: 'platforms.spotify', label: 'سبوتيفاي' },
  { type: 'url', name: 'platforms.apple_podcasts', label: 'آبل بودكاست' },
  { type: 'url', name: 'platforms.youtube', label: 'يوتيوب' },
  { type: 'url', name: 'platforms.anghami', label: 'أنغامي' },
  { type: 'section', title: 'حسابات التواصل الاجتماعي' },
  { type: 'url', name: 'social.x', label: 'X' },
  { type: 'url', name: 'social.instagram', label: 'إنستغرام' },
  { type: 'url', name: 'social.tiktok', label: 'تيك توك' },
  { type: 'url', name: 'social.youtube', label: 'يوتيوب' },
  { type: 'url', name: 'social.linkedin', label: 'لينكدإن' },
  { type: 'section', title: 'الهوية' },
  {
    type: 'select',
    name: 'brand.display_font',
    label: 'خط العناوين',
    hint: 'WARD TYPE يُفعّل بعد استبدال ملف الخط بنسخة سليمة (راجع README). الافتراضي IBM Plex Sans Arabic.',
    options: [
      { value: 'plex', label: 'IBM Plex Sans Arabic' },
      { value: 'ward', label: 'WARD TYPE' },
    ],
  },
  { type: 'section', title: 'التنبيهات' },
  { type: 'email', name: 'notifications.inbox_email', label: 'بريد استلام تنبيهات الرسائل', hint: 'للتوثيق. التنبيهات الفعلية تُرسل إلى INBOX_NOTIFY_EMAIL في متغيرات البيئة.' },
];

export default async function SettingsPage() {
  await requireStaff('settings.manage');
  const rows = await listTable('site_settings', 'key, value', { order: 'key' });
  const get = (key: string) => (rows.find((r) => r.key === key)?.value ?? {}) as Record<string, unknown>;
  const clean = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o[k] ?? '']));
  const values = {
    general: clean(get('general'), ['site_name', 'site_name_en', 'tagline', 'tagline_en', 'contact_email', 'announcement']),
    platforms: clean(get('platforms'), ['spotify', 'apple_podcasts', 'youtube', 'anghami']),
    social: clean(get('social'), ['x', 'instagram', 'tiktok', 'youtube', 'linkedin']),
    brand: { display_font: get('brand').display_font === 'ward' ? 'ward' : 'plex' },
    notifications: clean(get('notifications'), ['inbox_email']),
  };
  return (
    <>
      <AdminHeader title="إعدادات الموقع" />
      <div className="max-w-4xl">
        <EntityForm schema="settings" action={saveSettings} fields={FIELDS} defaultValues={values} />
      </div>
    </>
  );
}
