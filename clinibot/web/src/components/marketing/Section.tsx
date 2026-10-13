import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView } from "./motion";

interface SectionProps {
  id: string;
  /** id of the section's heading (aria-labelledby). */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * A landing-page section. Its living element (class `mk-live`) only runs while
 * the section is near the viewport: data-live="off" pauses it.
 */
export function Section({ id, labelledBy, className, children }: SectionProps) {
  const ref = useRef<HTMLElement>(null);
  const near = useInView(ref, { rootMargin: "120px 0px" });
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={labelledBy}
      data-live={near ? "on" : "off"}
      className={cn("mk-anchor relative", className)}
    >
      {children}
    </section>
  );
}

interface SectionHeadingProps {
  id: string;
  kicker?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  align?: "start" | "center";
  tone?: "default" | "inverse";
  className?: string;
}

/** Kicker + h2 + intro. The h2 can receive focus after in-page navigation. */
export function SectionHeading({
  id,
  kicker,
  title,
  intro,
  align = "start",
  tone = "default",
  className,
}: SectionHeadingProps) {
  const inverse = tone === "inverse";
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {kicker && (
        <p
          className={cn(
            "text-sm font-bold tracking-wide",
            inverse ? "text-emerald-200" : "text-accent-strong",
          )}
        >
          {kicker}
        </p>
      )}
      <h2
        id={id}
        tabIndex={-1}
        data-focus-target=""
        className={cn(
          "max-w-[24ch] text-[1.75rem] leading-tight font-extrabold text-balance sm:text-4xl",
          inverse ? "text-white" : "text-slate-900",
        )}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={cn(
            "max-w-[58ch] text-base leading-relaxed sm:text-lg",
            inverse ? "text-white/85" : "text-slate-600",
          )}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
