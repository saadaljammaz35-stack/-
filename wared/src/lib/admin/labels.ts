export const MESSAGE_STATUS = [
  { value: 'new', label: 'جديدة' },
  { value: 'in_progress', label: 'قيد المتابعة' },
  { value: 'resolved', label: 'تمت' },
  { value: 'archived', label: 'مؤرشفة' },
  { value: 'spam', label: 'مزعجة' },
];

export const SPONSORSHIP_STATUS = [
  { value: 'new', label: 'جديد' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'negotiating', label: 'تفاوض' },
  { value: 'won', label: 'تم الاتفاق' },
  { value: 'lost', label: 'لم يتم' },
  { value: 'archived', label: 'مؤرشف' },
];

export const MESSAGE_KINDS: Record<string, string> = {
  general: 'استفسار عام',
  careers: 'انضمام للفريق',
  press: 'إعلام وصحافة',
  guest_suggestion: 'اقتراح ضيف',
  feedback: 'ملاحظات',
};

export const BUDGETS: Record<string, string> = {
  under_25k: 'أقل من 25 ألف ريال',
  '25k_75k': '25–75 ألف ريال',
  '75k_200k': '75–200 ألف ريال',
  over_200k: 'أكثر من 200 ألف ريال',
  undisclosed: 'لم تُحدد',
};

export const INTERESTS: Record<string, string> = {
  episode_sponsor: 'رعاية حلقات',
  series_partner: 'شراكة برنامج',
  branded_content: 'محتوى برعاية',
  events: 'فعاليات',
};

export function labelOf(list: { value: string; label: string }[], value: unknown): string {
  return list.find((i) => i.value === value)?.label ?? String(value ?? '');
}
