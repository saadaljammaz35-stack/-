import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'glass' | 'ghost';
type Size = 'md' | 'lg' | 'sm';

const base =
  'group/btn relative inline-flex items-center justify-center gap-3 rounded-full font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-500 ease-[var(--ease-out-expo)] active:scale-[0.97] focus-visible:outline-offset-4';

const sizes: Record<Size, string> = {
  sm: 'h-10 px-5 text-sm',
  md: 'h-12 px-6 text-[0.95rem]',
  lg: 'h-14 px-8 text-base sm:h-16 sm:px-10 sm:text-lg',
};

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-[linear-gradient(135deg,#4f74ff_0%,#2e50e8_55%,#2645d6_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-1px_0_rgb(0_0_0/0.2),0_10px_30px_-10px_rgb(65_105_255/0.8)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-1px_0_rgb(0_0_0/0.2),0_16px_44px_-8px_rgb(65_105_255/0.95)]',
  glass: 'glass glass-rim text-white hover:bg-white/10',
  ghost: 'text-white hover:text-icy',
};

function Inner({ children, arrow }: { children: ReactNode; arrow: boolean }) {
  return (
    <>
      <span className="relative">{children}</span>
      {arrow ? (
        <span className="relative grid size-6 place-items-center overflow-hidden rounded-full bg-white/15">
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/btn:translate-x-[140%] rtl:-scale-x-100 rtl:group-hover/btn:-translate-x-[140%]"
          />
          <ArrowRight
            aria-hidden="true"
            className="absolute size-3.5 -translate-x-[140%] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/btn:translate-x-0 rtl:translate-x-[140%] rtl:-scale-x-100 rtl:group-hover/btn:translate-x-0"
          />
        </span>
      ) : null}
    </>
  );
}

/**
 * Link styled as a button. In-page anchors (`#id`) render a plain `<a>` so the
 * smooth-scroll handler owns them; everything else uses Next.js `<Link>`.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  arrow = true,
  className = '',
  children,
  href,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & {
  href: string;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
}) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (href.startsWith('#')) {
    return (
      <a href={href} className={cls} {...props}>
        <Inner arrow={arrow}>{children}</Inner>
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      <Inner arrow={arrow}>{children}</Inner>
    </Link>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  arrow = false,
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; arrow?: boolean }) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      <Inner arrow={arrow}>{children}</Inner>
    </button>
  );
}
