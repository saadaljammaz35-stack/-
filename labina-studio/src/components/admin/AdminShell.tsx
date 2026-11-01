"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  CircleQuestionMark,
  Clock,
  Contact,
  ExternalLink,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Quote,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { signOut } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean; badge?: "messages" | "pending" };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "الحجوزات",
    items: [
      { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
      { href: "/admin/bookings", label: "الحجوزات", icon: CalendarCheck, badge: "pending" },
      { href: "/admin/customers", label: "العملاء", icon: Users },
      { href: "/admin/messages", label: "الرسائل", icon: Inbox, badge: "messages" },
    ],
  },
  {
    group: "المحتوى",
    items: [
      { href: "/admin/services", label: "الخدمات", icon: Sparkles, adminOnly: true },
      { href: "/admin/pricing", label: "الأسعار", icon: Tag, adminOnly: true },
      { href: "/admin/gallery", label: "معرض الصور", icon: Images, adminOnly: true },
      { href: "/admin/testimonials", label: "آراء العملاء", icon: Quote, adminOnly: true },
      { href: "/admin/faq", label: "الأسئلة الشائعة", icon: CircleQuestionMark, adminOnly: true },
      { href: "/admin/content", label: "محتوى الصفحة الرئيسية", icon: FileText, adminOnly: true },
    ],
  },
  {
    group: "الإعدادات",
    items: [
      { href: "/admin/hours", label: "مواعيد العمل", icon: Clock, adminOnly: true },
      { href: "/admin/contact", label: "بيانات التواصل", icon: Contact, adminOnly: true },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  role,
  name,
  email,
  counts,
}: {
  children: ReactNode;
  role: "admin" | "staff";
  name: string;
  email: string;
  counts: { pending: number; messages: number };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const nav = (
    <nav aria-label="قائمة لوحة التحكم" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => role === "admin" || !i.adminOnly);
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="mb-2 px-3 text-xs font-semibold text-cream/45">{g.group}</p>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = isActive(pathname, i.href);
                const badge = i.badge ? counts[i.badge] : 0;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-cream text-plum" : "text-cream/80 hover:bg-cream/10 hover:text-cream",
                      )}
                    >
                      <i.icon className="size-[1.1rem] shrink-0" aria-hidden />
                      <span className="flex-1">{i.label}</span>
                      {badge > 0 && (
                        <span className={cn("min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold", active ? "bg-coral text-ink" : "bg-sun text-ink")}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-cream/10 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-sun font-display font-bold text-ink">{name.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-cream">{name}</p>
          <p className="truncate text-xs text-cream/55">{role === "admin" ? "مسؤول" : "موظف"} · {email}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/" target="_blank" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cream/10 px-3 py-2 text-xs font-semibold text-cream hover:bg-cream/20">
          <ExternalLink className="size-3.5" /> الموقع
        </Link>
        <form action={signOut} className="flex-1">
          <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-coral px-3 py-2 text-xs font-semibold text-ink">
            <LogOut className="size-3.5" /> خروج
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-plum lg:flex">
        <div className="px-6 py-6">
          <Link href="/admin" aria-label="لوحة التحكم">
            <Logo light compact />
          </Link>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-plum px-4 lg:hidden">
        <Link href="/admin" aria-label="لوحة التحكم">
          <Logo light compact />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative grid size-10 place-items-center rounded-xl bg-cream/10 text-cream"
          aria-label="فتح القائمة"
          aria-expanded={open}
        >
          <Menu className="size-5" />
          {counts.pending + counts.messages > 0 && <span className="absolute -left-1 -top-1 size-3 rounded-full bg-sun ring-2 ring-plum" />}
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-xs flex-col bg-plum lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              role="dialog"
              aria-modal="true"
              aria-label="القائمة"
            >
              <div className="flex items-center justify-between px-5 py-5">
                <Logo light compact />
                <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl bg-cream/10 text-cream" aria-label="إغلاق القائمة">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
              {footer}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
