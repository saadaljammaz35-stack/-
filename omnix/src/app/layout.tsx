import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { cookies } from "next/headers";
import { dirOf } from "@/lib/i18n";
import { getLocale } from "@/lib/server/session";

export const metadata: Metadata = {
  title: { default: "OMNIX", template: "%s · OMNIX" },
  description: "OMNIX — private, customizable AI models.",
  icons: { icon: "/brand/omnix-mark.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#101116" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get("omnix_theme")?.value;
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme={theme === "light" || theme === "dark" ? theme : undefined} className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
