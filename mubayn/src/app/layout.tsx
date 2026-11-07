import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Readex_Pro } from "next/font/google";
import localFont from "next/font/local";
import { Footer, Header } from "@/components/chrome";
import { getLocale } from "@/lib/locale";
import "./globals.css";

const plexArabic = localFont({
  src: [
    { path: "../assets/fonts/PlexArabic-Regular.ttf", weight: "400" },
    { path: "../assets/fonts/PlexArabic-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-plex-ar",
  display: "swap",
});
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "مُبيّن MUBAYN — افحص الجهاز المستعمل قبل لا تشتريه", template: "%s · MUBAYN" },
  description: "ارفع صور الجهاز المستعمل ويطلع لك تقرير حالة مبني على الصور بالذكاء الاصطناعي، مجاناً. Evidence-based AI condition reports for used devices.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3efe6" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${plexArabic.variable} ${readex.variable} ${mono.variable}`}>
      <body>
        <Header locale={locale} />
        <main id="main">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
