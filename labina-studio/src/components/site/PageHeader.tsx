import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Motion";

const BLOCKS = ["bg-coral h-6", "bg-sun h-10", "bg-lavender h-14", "bg-teal h-8", "bg-plum h-16"];

export function PageHeader({ eyebrow, title, text, children }: { eyebrow?: string; title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <section className="container-x pb-12 pt-8 md:pb-16 md:pt-16">
      <Reveal className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <h1 className="text-[clamp(2.4rem,7vw,4.75rem)] font-extrabold leading-[1.1] text-plum">{title}</h1>
          {text && <p className="mt-5 max-w-2xl text-lg leading-9 text-ink-soft md:text-xl">{text}</p>}
          {children}
        </div>
        <div className="hidden items-end gap-2 md:flex" aria-hidden>
          {BLOCKS.map((b) => (
            <span key={b} className={`w-6 rounded-lg ${b}`} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
