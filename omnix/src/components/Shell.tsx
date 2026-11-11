"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/client/api";
import * as I from "./icons";

type NavItem = { href: string; key: keyof Dict["nav"]; icon: (p: object) => ReactNode };

const NAV: { group?: "lab" | "ops"; items: NavItem[] }[] = [
  {
    items: [
      { href: "/ai", key: "dashboard", icon: I.IconHome },
      { href: "/hub", key: "hub", icon: I.IconHub },
      { href: "/ai/chat", key: "chat", icon: I.IconChat },
      { href: "/ai/model", key: "model", icon: I.IconModel },
      { href: "/ai/knowledge", key: "knowledge", icon: I.IconBook },
      { href: "/ai/memory", key: "memory", icon: I.IconMemory },
    ],
  },
  {
    group: "lab",
    items: [
      { href: "/ai/training", key: "training", icon: I.IconFlask },
      { href: "/ai/datasets", key: "datasets", icon: I.IconData },
      { href: "/ai/evaluations", key: "evaluations", icon: I.IconGauge },
      { href: "/ai/versions", key: "versions", icon: I.IconLayers },
    ],
  },
  {
    group: "ops",
    items: [
      { href: "/ai/deploy", key: "deploy", icon: I.IconRocket },
      { href: "/ai/api", key: "api", icon: I.IconCode },
      { href: "/ai/usage", key: "usage", icon: I.IconChart },
    ],
  },
];

const PHONE_TABS = ["/ai", "/ai/chat", "/ai/knowledge", "/ai/training"];

function isActive(path: string, href: string) {
  return href === "/ai" ? path === "/ai" : path === href || path.startsWith(`${href}/`);
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function Shell({ t, locale, userName, children }: { t: Dict; locale: Locale; userName: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const all = NAV.flatMap((g) => g.items);

  const switchLocale = async () => {
    const next = locale === "ar" ? "en" : "ar";
    setCookie("omnix_locale", next);
    await api("/api/auth/me", { method: "PATCH", body: { locale: next } }).catch(() => {});
    router.refresh();
  };
  const switchTheme = () => {
    const el = document.documentElement;
    const dark = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    el.dataset.theme = next;
    setCookie("omnix_theme", next);
  };
  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="OMNIX">
        <Link href="/ai" className="brand">
          <Image className="brand-mark logo-mark" src="/brand/omnix-mark.png" alt="" width={28} height={28} priority />
          <span>
            OMNIX<small>{t.tagline}</small>
          </span>
        </Link>
        {NAV.map((g, i) => (
          <div key={i} style={{ display: "contents" }}>
            {g.group && <div className="nav-group">{g.group === "lab" ? t.nav.training.split(" ")[0] : t.nav.deploy}</div>}
            {g.items.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link" aria-current={isActive(path, n.href) ? "page" : undefined} title={t.nav[n.key]}>
                <n.icon />
                <span className="label">{t.nav[n.key]}</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <button className="nav-link btn ghost" onClick={switchLocale} title={t.common.language}>
            <I.IconGlobe />
            <span className="label">{t.common.language}</span>
          </button>
          <button className="nav-link btn ghost" onClick={switchTheme} title={t.common.theme}>
            <I.IconMoon />
            <span className="label">{t.common.theme}</span>
          </button>
          <button className="nav-link btn ghost" onClick={signOut} title={t.common.signOut}>
            <I.IconLogout />
            <span className="label">
              {t.common.signOut} · {userName}
            </span>
          </button>
        </div>
      </nav>

      <main className="main">
        {children}
      </main>

      <nav className="mobile-tabs" aria-label="OMNIX">
        {PHONE_TABS.map((href) => {
          const n = all.find((x) => x.href === href)!;
          return (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined} onClick={() => setMore(false)}>
              <n.icon />
              {t.nav[n.key]}
            </Link>
          );
        })}
        <button onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <I.IconMore />
          {t.nav.more}
        </button>
      </nav>
      {more && <div className="sheet-backdrop" onClick={() => setMore(false)} aria-hidden />}
      {more && (
        <div className="more-sheet" role="dialog" aria-label={t.nav.more}>
          {all
            .filter((n) => !PHONE_TABS.includes(n.href))
            .map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMore(false)}>
                <n.icon />
                {t.nav[n.key]}
              </Link>
            ))}
          <button className="btn ghost" onClick={switchLocale}>
            {t.common.language}
          </button>
          <button className="btn ghost" onClick={switchTheme}>
            {t.common.theme}
          </button>
          <button className="btn ghost danger" onClick={signOut}>
            {t.common.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
