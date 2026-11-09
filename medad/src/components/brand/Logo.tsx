import type { Locale } from '@/lib/i18n';
import {
  MARK_PATH,
  MARK_VIEWBOX,
  WORDMARK_AR_PATH,
  WORDMARK_AR_VIEWBOX,
  WORDMARK_EN_PATH,
  WORDMARK_EN_VIEWBOX,
} from './paths';

export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

export function Wordmark({ locale, className }: { locale: Locale; className?: string }) {
  const ar = locale === 'ar';
  return (
    <svg
      viewBox={ar ? WORDMARK_AR_VIEWBOX : WORDMARK_EN_VIEWBOX}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" fillRule="evenodd" d={ar ? WORDMARK_AR_PATH : WORDMARK_EN_PATH} />
    </svg>
  );
}

/** Mark + wordmark lockup, sized by its height. */
export function Logo({ locale, className = '' }: { locale: Locale; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="h-full w-auto" />
      <Wordmark
        locale={locale}
        className={locale === 'ar' ? 'h-[78%] w-auto' : 'h-[46%] w-auto'}
      />
    </span>
  );
}
