import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getSiteData } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { AboutVisual, MissionVision, ValuesGrid } from "@/components/site/AboutBlocks";
import { Process } from "@/components/site/Process";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Motion";

export const metadata: Metadata = {
  title: "من نحن",
  description: "قصة استوديو لَبِنة ورسالته ورؤيته: استوديو متخصص في تصوير الأطفال والعائلات وصناعة الذكريات.",
};

export default async function AboutPage() {
  const { home } = await getSiteData();
  return (
    <>
      <PageHeader eyebrow="من نحن" title={home.about_title} />
      <section className="container-x grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <AboutVisual home={home} />
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.1}>
          <h2 className="font-display text-2xl font-semibold text-plum md:text-3xl">قصتنا</h2>
          {home.about_story.split(/\n+/).map((p, i) => (
            <p key={i} className="mt-5 text-lg leading-9 text-ink-soft">{p}</p>
          ))}
          <div className="mt-10">
            <MissionVision home={home} />
          </div>
        </Reveal>
      </section>

      {home.values.length > 0 && (
        <section className="container-x py-16 md:py-28">
          <SectionHeading eyebrow="قيمنا" title="ما نتمسك به في كل جلسة" />
          <ValuesGrid values={home.values} />
        </section>
      )}

      <Process />

      <section className="container-x">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-sun p-8 md:p-14">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold leading-tight text-plum md:text-5xl">{home.cta_title}</h2>
            {home.cta_text && <p className="mt-4 text-lg leading-8 text-ink">{home.cta_text}</p>}
            <ButtonLink href="/booking" variant="dark" size="lg" className="mt-8" icon={<CalendarDays className="size-5" aria-hidden />}>
              احجز جلستك
            </ButtonLink>
          </div>
          <div className="absolute -bottom-6 -left-4 hidden items-end gap-3 md:flex" aria-hidden>
            <span className="h-28 w-16 rounded-2xl bg-coral" />
            <span className="h-44 w-16 rounded-2xl bg-plum" />
            <span className="h-36 w-16 rounded-2xl bg-teal" />
          </div>
        </Reveal>
      </section>
    </>
  );
}
