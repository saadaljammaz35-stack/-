import { t, type Key, type Locale } from "@/lib/i18n";

export function StatusChip({ status, locale }: { status: string; locale: Locale }) {
  return <span className={`chip st st-${status}`}>{t(locale, `st_${status}` as Key)}</span>;
}
