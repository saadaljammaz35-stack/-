// What the widgets show before the app first fills them in (and whenever it cannot share data
// with them). Built into the widget at compile time, so a new widget is never blank. The texts
// come from the app's content database, formatted as src/features/widgets/update.ts does.
import type { DailyWidgetProps, KhatmaWidgetProps, WidgetPending } from './types';

export const PENDING: WidgetPending = { pending: true };

export const DAILY_DEFAULT: DailyWidgetProps = {
  ayah: { text: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا لِى وَلَا تَكْفُرُونِ ﴿١٥٢﴾', ref: 'سورة البقرة: 152' },
  hadith: {
    text: 'عن جابر بن عبد الله رضي الله عنهما عن النبي صلى الله عليه وسلم قال: «كُلُّ مَعْرُوفٍ صَدَقَةٌ».',
    ref: 'رواه البخاري من حديث جابر، ورواه مسلم من حديث حذيفة — صحيح',
  },
  dhikr: {
    text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ ﴿٦﴾ صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ ﴿٧﴾',
    ref: 'سورة الفاتحة: 6–7',
  },
  style: 'cream',
};

export const KHATMA_DEFAULT: KhatmaWidgetProps = { name: 'الختمة', percent: 0, today: 'ابدأ ختمة جديدة من التطبيق', detail: '', style: 'green' };
