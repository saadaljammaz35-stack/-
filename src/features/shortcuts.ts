import {
  BookHeart,
  BookOpen,
  Brain,
  CalendarCheck,
  CalendarDays,
  Compass,
  Gem,
  HandHeart,
  Moon,
  Radio,
  Scale,
  ScrollText,
  Sunrise,
  Sunset,
  Target,
  Tv,
  UsersRound,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';

import type { HomeShortcut } from '@/store/settings';

export type ShortcutDef = { id: HomeShortcut; ar: string; en: string; icon: LucideIcon; route: string; tint: number };

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'my-prayers', ar: 'صلاتي', en: 'My prayers', icon: CalendarCheck, route: '/prayer-log', tint: 0 },
  { id: 'hifz', ar: 'الحفظ', en: 'Memorise', icon: Brain, route: '/hifz', tint: 5 },
  { id: 'harvest', ar: 'حصادي', en: 'My harvest', icon: Wheat, route: '/harvest', tint: 3 },
  { id: 'group', ar: 'الختمة الجماعية', en: 'Group khatma', icon: UsersRound, route: '/group', tint: 1 },
  { id: 'tasbih', ar: 'المسبحة', en: 'Tasbih', icon: Target, route: '/tasbih', tint: 0 },
  { id: 'qibla', ar: 'اتجاه القبلة', en: 'Qibla', icon: Compass, route: '/qibla', tint: 1 },
  { id: 'after-prayer', ar: 'أذكار بعد الصلاة', en: 'After prayer', icon: HandHeart, route: '/adhkar/after-prayer', tint: 4 },
  { id: 'live', ar: 'بث الحرمين', en: 'Haramain live', icon: Tv, route: '/live', tint: 5 },
  { id: 'khatma', ar: 'الختمة', en: 'Khatma', icon: BookOpen, route: '/khatma', tint: 2 },
  { id: 'names', ar: 'أسماء الله الحسنى', en: 'Names of Allah', icon: Gem, route: '/names', tint: 3 },
  { id: 'hadith', ar: 'الأحاديث', en: 'Hadith', icon: ScrollText, route: '/hadith', tint: 2 },
  { id: 'duas', ar: 'الأدعية', en: 'Duas', icon: BookHeart, route: '/duas', tint: 1 },
  { id: 'radio', ar: 'إذاعات القرآن', en: 'Quran radio', icon: Radio, route: '/live', tint: 3 },
  { id: 'calendar', ar: 'التقويم الهجري', en: 'Hijri calendar', icon: CalendarDays, route: '/calendar', tint: 0 },
  { id: 'fatwa', ar: 'الفتاوى', en: 'Fatwas', icon: Scale, route: '/fatwa', tint: 4 },
  { id: 'morning', ar: 'أذكار الصباح', en: 'Morning adhkar', icon: Sunrise, route: '/adhkar/morning', tint: 3 },
  { id: 'evening', ar: 'أذكار المساء', en: 'Evening adhkar', icon: Sunset, route: '/adhkar/evening', tint: 1 },
  { id: 'sleep', ar: 'أذكار النوم', en: 'Sleep adhkar', icon: Moon, route: '/adhkar/sleep', tint: 2 },
];

export const shortcut = (id: HomeShortcut) => SHORTCUTS.find((s) => s.id === id)!;
