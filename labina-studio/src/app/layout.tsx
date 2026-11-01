import type { Metadata, Viewport } from "next";
import "@fontsource-variable/alexandria";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { MotionProvider } from "@/components/ui/Motion";
import { env } from "@/lib/env";
import { DEFAULT_HOME_TEXT } from "@/lib/defaults";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "لَبِنة | استوديو الطفولة", template: "%s | لَبِنة" },
  description: DEFAULT_HOME_TEXT.seo_description,
  applicationName: "لَبِنة",
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "لَبِنة",
    title: "لَبِنة | استوديو الطفولة",
    description: DEFAULT_HOME_TEXT.seo_description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F5EEDC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
