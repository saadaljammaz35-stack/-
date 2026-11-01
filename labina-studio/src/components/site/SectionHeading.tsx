import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Motion";

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "start",
  className,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  align?: "start" | "center";
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Reveal
      className={cn(
        "mb-10 flex flex-col gap-5 md:mb-14",
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.15] text-plum">{title}</h2>
        {text && <p className="mt-4 text-lg leading-8 text-ink-soft">{text}</p>}
      </div>
      {action}
    </Reveal>
  );
}
