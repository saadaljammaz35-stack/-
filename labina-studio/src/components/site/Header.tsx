"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { EASE } from "@/components/ui/Motion";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const MENU_BLOCKS = ["bg-coral", "bg-sun", "bg-lavender", "bg-teal", "bg-plum"];

export function Header() {
  // Vercel pre-renders the home route as "/index"; normalise so the server
  // and browser agree on the active link (otherwise hydration fails).
  const rawPath = usePathname();
  const pathname = !rawPath || rawPath === "/index" ? "/" : rawPath;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu after navigating
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500",
        scrolled || open ? "bg-cream/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="container-x flex h-[4.5rem] items-center justify-between gap-4 md:h-20">
        <Link href="/" aria-label="لَبِنة، الصفحة الرئيسية" className="rounded-xl">
          <Logo />
        </Link>

        <nav aria-label="القائمة الرئيسية" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-xl px-3.5 py-2 text-[0.95rem] font-medium transition-colors",
                      active ? "text-plum" : "text-ink-soft hover:text-plum",
                    )}
                  >
                    {link.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-x-3 -bottom-0.5 h-1 rounded-full bg-coral"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href="/booking" size="md" className="max-[359px]:!hidden" icon={<CalendarDays className="size-4" aria-hidden />}>
            احجز جلستك
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-2xl bg-plum text-cream transition-transform active:scale-95 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
    </header>

      {/* Rendered outside <header>: its backdrop-filter would otherwise trap position:fixed */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-x-0 bottom-0 top-[4.5rem] z-40 overflow-y-auto bg-cream md:top-20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <nav aria-label="قائمة الجوال" className="container-x flex min-h-full flex-col pb-10 pt-6">
              <ul className="flex flex-col">
                {NAV_LINKS.map((link, i) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.05 + i * 0.05 }}
                      className="border-b border-line"
                    >
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className="flex items-center justify-between py-4 font-display text-2xl font-semibold text-plum"
                      >
                        {link.label}
                        <span className={cn("size-3.5 rounded-[0.3rem]", MENU_BLOCKS[i % MENU_BLOCKS.length], !active && "opacity-30")} />
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.4 }}
                className="mt-8"
              >
                <ButtonLink href="/booking" size="lg" className="w-full" icon={<CalendarDays className="size-5" aria-hidden />}>
                  احجز جلستك
                </ButtonLink>
              </motion.div>
              <div className="mt-auto flex items-end gap-2 pt-12" aria-hidden>
                {[40, 72, 56, 96, 64].map((h, i) => (
                  <motion.span
                    key={i}
                    className={cn("w-full rounded-xl", MENU_BLOCKS[i])}
                    initial={{ height: 0 }}
                    animate={{ height: h }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.06 }}
                  />
                ))}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
