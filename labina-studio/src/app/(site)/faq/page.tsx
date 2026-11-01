import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getFaqs } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة",
  description: "إجابات عن أكثر الأسئلة تكراراً حول الحجز والجلسات في استوديو لَبِنة.",
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <>
      <PageHeader eyebrow="الأسئلة الشائعة" title="كل ما تودون معرفته قبل الجلسة" />
      <div className="container-x grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {faqs.length > 0 ? <FaqAccordion items={faqs} /> : <p className="rounded-3xl bg-paper p-8 text-ink-soft">لا توجد أسئلة منشورة حالياً.</p>}
        </div>
        <aside className="lg:col-span-4">
          <div className="sticky top-28 rounded-[1.75rem] bg-plum p-7 text-cream">
            <h2 className="font-display text-2xl font-semibold">لم تجد إجابتك؟</h2>
            <p className="mt-3 leading-8 text-cream/75">اسألنا مباشرة، ويسعدنا الرد عليك.</p>
            <ButtonLink href="/contact" variant="sun" className="mt-6" icon={<MessageCircle className="size-4" aria-hidden />}>
              تواصل معنا
            </ButtonLink>
          </div>
        </aside>
      </div>
      {faqs.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
    </>
  );
}
