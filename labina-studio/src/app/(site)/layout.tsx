import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getSiteData } from "@/lib/data/public";

// Public pages are static and refreshed every 5 minutes, or immediately
// when content changes in the dashboard (revalidatePath).
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteData();
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[200] rounded-xl bg-plum px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        تخطَّ إلى المحتوى
      </a>
      <Header />
      <main id="main" className="overflow-x-clip">
        {children}
      </main>
      <Footer contact={site.contact} />
    </>
  );
}
