import { router } from 'expo-router';
import {
  BookHeart,
  BellOff,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  Clock,
  Footprints,
  Gem,
  HandCoins,
  Hourglass,
  Landmark,
  MapPinned,
  Library,
  Monitor,
  Moon,
  NotebookPen,
  Plane,
  Radio,
  Scale,
  SunMoon,
  ScrollText,
  Settings,
  Target,
  Tv,
  UsersRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import { TabScreen } from '@/components/screen';
import { Group, IconCircle, Row, SectionHeader, Tap, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type Item = { ar: string; en: string; icon: LucideIcon; route: string };

const SERVICES: Item[] = [
  { ar: 'مواقيت الصلاة', en: 'Prayer times', icon: Clock, route: '/prayer' },
  { ar: 'صلاتي', en: 'My prayers', icon: CalendarCheck, route: '/prayer-log' },
  { ar: 'بين الأذان والإقامة', en: 'Adhan to iqama', icon: Hourglass, route: '/between' },
  { ar: 'خطة القضاء', en: 'Make-up plan', icon: CalendarClock, route: '/qada' },
  { ar: 'خطواتك إلى المسجد', en: 'Steps to the mosque', icon: Footprints, route: '/walk' },
  { ar: 'صامت في المسجد', en: 'Silent at the mosque', icon: BellOff, route: '/mosque-silent' },
  { ar: 'دليل السفر', en: 'Travel guide', icon: Plane, route: '/travel' },
  { ar: 'الختمة', en: 'Khatma', icon: BookOpen, route: '/khatma' },
  { ar: 'الختمة الجماعية', en: 'Group khatma', icon: UsersRound, route: '/group' },
  { ar: 'الحفظ', en: 'Memorise', icon: Brain, route: '/hifz' },
  { ar: 'حصادي', en: 'My harvest', icon: Wheat, route: '/harvest' },
  { ar: 'الأحاديث النبوية', en: 'Hadith', icon: ScrollText, route: '/hadith' },
  { ar: 'الأدعية', en: 'Duas', icon: BookHeart, route: '/duas' },
  { ar: 'دفتر دعائي', en: 'My duas', icon: NotebookPen, route: '/duas/mine' },
  { ar: 'أسماء الله الحسنى', en: 'Names of Allah', icon: Gem, route: '/names' },
  { ar: 'المسبحة', en: 'Tasbih', icon: Target, route: '/tasbih' },
  { ar: 'أذكار المواقف', en: 'Adhkar for the moment', icon: MapPinned, route: '/adhkar/situations' },
  { ar: 'الأيام الفاضلة', en: 'Virtuous days', icon: CalendarHeart, route: '/virtues' },
  { ar: 'المساجد القريبة', en: 'Nearby mosques', icon: Landmark, route: '/mosques' },
  { ar: 'رمضان والصيام', en: 'Ramadan & fasting', icon: Moon, route: '/ramadan' },
  { ar: 'التقويم الهجري', en: 'Hijri calendar', icon: CalendarDays, route: '/calendar' },
  { ar: 'السماء', en: 'The sky', icon: SunMoon, route: '/sky' },
  { ar: 'شاشة المسجد', en: 'Mosque screen', icon: Monitor, route: '/mosque-screen' },
  { ar: 'بث الحرمين والإذاعات', en: 'Haramain & radio', icon: Tv, route: '/live' },
  { ar: 'الفتاوى', en: 'Fatwas', icon: Scale, route: '/fatwa' },
  { ar: 'حصن المسلم', en: 'Hisn al-Muslim', icon: Library, route: '/hisn' },
  { ar: 'إحسان', en: 'Ehsan', icon: HandCoins, route: '/donate' },
];

export default function MoreTab() {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <TabScreen title={tr('المزيد', 'More')} actions={[{ icon: Settings, label: tr('الإعدادات', 'Settings'), onPress: () => router.push('/settings') }]}>
      <View style={{ paddingHorizontal: 20, gap: 24 }}>
        <View>
          <SectionHeader title={tr('خدمات مع الله', 'Services')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
            {SERVICES.map((s, i) => (
              <Tap key={s.route} onPress={() => router.push(s.route as never)} style={{ width: '25%', alignItems: 'center', gap: 8 }} accessibilityLabel={tr(s.ar, s.en)}>
                <IconCircle icon={s.icon} size={64} tint={t.colors.tints[i % 6]} iconSize={26} />
                <Txt variant="label" center numberOfLines={2} style={{ paddingHorizontal: 2 }}>
                  {tr(s.ar, s.en)}
                </Txt>
              </Tap>
            ))}
          </View>
        </View>
        <Group title={tr('التطبيق', 'App')}>
          <Row icon={Settings} title={tr('الإعدادات', 'Settings')} subtitle={tr('المظهر، الإشعارات، الحساب، النسخ الاحتياطي', 'Appearance, alerts, account, backup')} onPress={() => router.push('/settings')} />
          <Row icon={Radio} title={tr('إذاعات القرآن الكريم', 'Quran radio')} onPress={() => router.push('/live')} />
          <Row icon={Library} title={tr('المصادر والتوثيق', 'Sources')} onPress={() => router.push('/settings/sources')} />
        </Group>
      </View>
    </TabScreen>
  );
}
