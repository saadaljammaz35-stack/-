/**
 * "N days" in Arabic: 3 to 10 take أيام, 11 to 99 take يومًا, and round
 * hundreds (and 101, 102) take يوم. Retention is 7 to 1825 days.
 * Keep in step with arabicDayCount in supabase/functions/_shared/assistant/notices.ts,
 * because the settings page previews the notice the server sends.
 */
export function arabicDayCount(days: number): string {
  const rest = days % 100;
  if (rest >= 3 && rest <= 10) return `${days} أيام`;
  if (rest === 0 || (days > 100 && rest <= 2)) return `${days} يوم`;
  return `${days} يومًا`;
}
