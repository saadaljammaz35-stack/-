import Link from 'next/link';
import { SearchIcon } from '@/components/ui/icons';
import type { Dictionary } from '@/lib/i18n';
import { localePath, type Locale } from '@/lib/i18n/config';
import { LocaleSwitch } from './LocaleSwitch';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { NavLink } from './NavLink';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const p = (path: string) => localePath(locale, path);
  const primary = [
    { href: p('/podcast'), label: dict.nav.podcast },
    { href: p('/episodes'), label: dict.nav.episodes },
    { href: p('/programs'), label: dict.nav.programs },
    { href: p('/stories'), label: dict.nav.stories },
    { href: p('/clips'), label: dict.nav.clips },
    { href: p('/guests'), label: dict.nav.guests },
  ];
  const secondary = [
    { href: p('/about'), label: dict.nav.about },
    { href: p('/search'), label: dict.nav.search },
    { href: p('/join'), label: dict.nav.join },
    { href: p('/sponsorship'), label: dict.nav.sponsorship },
    { href: p('/contact'), label: dict.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70">
      <a href="#main" className="sr-only-focusable absolute start-4 top-3 z-50 rounded-full bg-fg px-4 py-2 text-bg">
        {dict.nav.skipToContent}
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
        <Link href={p('/')} className="shrink-0" aria-label={dict.meta.siteName}>
          <Logo className="h-7 w-auto md:h-8" title={dict.meta.siteName} />
        </Link>
        <nav aria-label={dict.nav.home} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primary.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link href={p('/search')} className="grid size-11 place-items-center rounded-full hover:bg-surface" aria-label={dict.nav.search}>
            <SearchIcon size={20} />
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            <ThemeToggle />
            <LocaleSwitch />
          </div>
          <MobileMenu links={primary} secondary={secondary} />
        </div>
      </div>
    </header>
  );
}
