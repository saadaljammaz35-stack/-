import Image from "next/image";
import { LogoMark } from "@/components/brand/Logo";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import { cn } from "@/lib/cn";
import type { HomeSettings } from "@/lib/settings";

const VALUE_STYLES = ["bg-coral-soft", "bg-sun-soft", "bg-lavender-soft", "bg-teal-soft", "bg-paper", "bg-cream-2"];
const VALUE_DOTS = ["bg-coral", "bg-sun", "bg-lavender", "bg-teal", "bg-plum", "bg-coral"];

export function AboutVisual({ home }: { home: HomeSettings }) {
  return (
    <div className="relative">
      {home.about_image ? (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-lavender shadow-lift">
          <Image src={home.about_image} alt="من داخل استوديو لَبِنة" fill sizes="(min-width: 1024px) 40vw, 92vw" className="object-cover" />
        </div>
      ) : (
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[2rem] bg-plum shadow-lift">
          <LogoMark className="w-3/4" light />
          <p className="absolute bottom-6 right-6 left-6 text-center font-display text-lg font-semibold text-cream/80">لحظة فوق لحظة، تُبنى الحكاية</p>
        </div>
      )}
      <span className="absolute -left-4 -top-4 hidden size-20 animate-float rounded-2xl bg-sun md:block" aria-hidden />
      <span className="absolute -bottom-5 -right-5 hidden size-14 animate-float rounded-xl bg-coral [animation-delay:-3s] md:block" aria-hidden />
    </div>
  );
}

export function MissionVision({ home }: { home: HomeSettings }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {home.about_mission && (
        <div className="rounded-[1.75rem] bg-teal p-7 text-ink md:p-9">
          <p className="font-display text-sm font-semibold uppercase">رسالتنا</p>
          <p className="mt-3 font-display text-xl font-semibold leading-9 md:text-2xl md:leading-10">{home.about_mission}</p>
        </div>
      )}
      {home.about_vision && (
        <div className="rounded-[1.75rem] bg-plum p-7 text-cream md:p-9">
          <p className="font-display text-sm font-semibold text-sun">رؤيتنا</p>
          <p className="mt-3 font-display text-xl font-semibold leading-9 md:text-2xl md:leading-10">{home.about_vision}</p>
        </div>
      )}
    </div>
  );
}

export function ValuesGrid({ values }: { values: HomeSettings["values"] }) {
  if (!values.length) return null;
  return (
    <Stagger className="grid gap-3 sm:grid-cols-2">
      {values.map((v, i) => (
        <StaggerItem key={v.title} className={cn("rounded-3xl p-6", VALUE_STYLES[i % VALUE_STYLES.length])}>
          <span className={cn("mb-4 block size-4 rounded-[0.3rem]", VALUE_DOTS[i % VALUE_DOTS.length])} aria-hidden />
          <h3 className="font-display text-lg font-semibold text-plum">{v.title}</h3>
          <p className="mt-2 leading-7 text-ink-soft">{v.text}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
