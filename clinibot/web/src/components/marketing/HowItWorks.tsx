import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { buildSegments, litCount, pathData, pointAtY, revealProgress } from "./handoff";
import { useInView, useReducedMotion } from "./motion";
import { Section, SectionHeading } from "./Section";
import { container } from "./styles";

type Actor = "patient" | "assistant" | "reception";

const ACTORS: Record<Actor, { icon: LucideIcon; label: MessageKey }> = {
  patient: { icon: UserRound, label: "marketing.actorPatient" },
  assistant: { icon: Bot, label: "marketing.actorAssistant" },
  reception: { icon: UsersRound, label: "marketing.actorReception" },
};

const STEPS: ReadonlyArray<{ actor: Actor; title: MessageKey; text: MessageKey }> = [
  { actor: "patient", title: "marketing.step1Title", text: "marketing.step1Text" },
  { actor: "assistant", title: "marketing.step2Title", text: "marketing.step2Text" },
  { actor: "assistant", title: "marketing.step3Title", text: "marketing.step3Text" },
  { actor: "reception", title: "marketing.step4Title", text: "marketing.step4Text" },
];

/** Width of the line's column (px); the steps start after it. */
const LINE_WIDTH = 56;
const LINE_CENTER = LINE_WIDTH / 2;
const LINE_SWING = 16;

interface Geometry {
  height: number;
  ys: number[];
}

function sameGeometry(a: Geometry | null, b: Geometry | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.height - b.height) < 0.5 &&
    a.ys.length === b.ys.length &&
    a.ys.every((y, index) => Math.abs(y - (b.ys[index] ?? 0)) < 0.5)
  );
}

export function HowItWorks() {
  const { t, formatNumber } = useI18n();
  const reduced = useReducedMotion();
  const clipId = `mk-handoff-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  const timelineRef = useRef<HTMLDivElement>(null);
  const anchorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const clipRectRef = useRef<SVGRectElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const litRef = useRef(0);

  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [lit, setLit] = useState(0);
  const near = useInView(timelineRef, { rootMargin: "200px 0px" });

  // Measure where each step's actor badge sits, so the nodes line up with the
  // text at every width and in both languages.
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = timeline.getBoundingClientRect();
      const ys = anchorRefs.current.map((anchor) => {
        if (!anchor) return 0;
        const rect = anchor.getBoundingClientRect();
        return rect.top + rect.height / 2 - box.top;
      });
      const next = box.height > 0 && ys.every((y) => y > 0) ? { height: box.height, ys } : null;
      setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("resize", schedule);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(timeline);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, []);

  const segments = useMemo(
    () => (geometry ? buildSegments(geometry.ys, LINE_CENTER, LINE_SWING) : []),
    [geometry],
  );
  const d = useMemo(() => pathData(segments), [segments]);

  // Scroll drive: reveal the line up to the reading line. Runs only while the
  // section is near the viewport; with reduced motion the final state is shown
  // and nothing listens to scrolling.
  useEffect(() => {
    if (!geometry) return;
    const timeline = timelineRef.current;
    const apply = (progress: number) => {
      const revealedY = progress * geometry.height;
      clipRectRef.current?.setAttribute("transform", `scale(1 ${progress.toFixed(4)})`);
      const head = headRef.current;
      if (head) {
        const point = reduced ? null : pointAtY(segments, revealedY);
        head.style.opacity = point ? "1" : "0";
        if (point)
          head.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
      }
      const count = litCount(geometry.ys, revealedY);
      if (count !== litRef.current) {
        litRef.current = count;
        setLit(count);
      }
    };

    if (reduced) {
      apply(1);
      return;
    }
    if (!near || !timeline) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = timeline.getBoundingClientRect();
      apply(revealProgress(rect.top, rect.height, window.innerHeight));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [geometry, segments, reduced, near]);

  const shownLit = reduced ? STEPS.length : lit;

  return (
    <Section id="how-it-works" labelledBy="how-title" className="py-16 sm:py-24">
      <div
        className={cn(
          container,
          "grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16",
        )}
      >
        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="how-title"
            kicker={t("marketing.howKicker")}
            title={t("marketing.howTitle")}
            intro={t("marketing.howIntro")}
          />
          <p className="flex max-w-[52ch] gap-3 rounded-2xl bg-white/80 p-4 text-[0.9375rem] leading-relaxed text-slate-700 ring-1 ring-slate-200">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden="true" />
            <span>{t("marketing.howNote")}</span>
          </p>
        </div>

        <div ref={timelineRef} className="relative">
          {geometry && (
            <svg
              className="pointer-events-none absolute start-0 top-0"
              width={LINE_WIDTH}
              height={geometry.height}
              viewBox={`0 0 ${LINE_WIDTH} ${geometry.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect
                    ref={clipRectRef}
                    x="0"
                    y="0"
                    width={LINE_WIDTH}
                    height={geometry.height}
                    transform="scale(1 0)"
                  />
                </clipPath>
              </defs>
              <path
                d={d}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 7"
              />
              <path
                d={d}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                clipPath={`url(#${clipId})`}
              />
              {geometry.ys.map((y, index) => (
                <g
                  key={index}
                  className="mk-handoff__node"
                  data-lit={index < shownLit ? "true" : "false"}
                  transform={`translate(${LINE_CENTER} ${y.toFixed(2)})`}
                >
                  <circle className="mk-handoff__ring" r="15" fill="#10B981" fillOpacity="0.14" />
                  <circle r="9" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
                  <g className="mk-handoff__node-lit">
                    <circle r="9" fill="#0F4C81" />
                    <circle r="3.2" fill="#FFFFFF" />
                  </g>
                </g>
              ))}
              <g ref={headRef} className="mk-handoff__head">
                <circle
                  className="mk-live mk-live--pulse"
                  r="6"
                  fill="#10B981"
                  style={{ "--mk-live-duration": "4.4s" } as CSSProperties}
                />
                <circle r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
              </g>
            </svg>
          )}

          <ol className="flex flex-col gap-10" style={{ paddingInlineStart: LINE_WIDTH + 16 }}>
            {STEPS.map((step, index) => {
              const actor = ACTORS[step.actor];
              const Icon = actor.icon;
              return (
                <li
                  key={step.title}
                  className="mk-step"
                  data-lit={index < shownLit ? "true" : "false"}
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      ref={(element) => {
                        anchorRefs.current[index] = element;
                      }}
                      className="relative isolate inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 font-bold text-primary ring-1 ring-slate-200"
                    >
                      <span
                        className="mk-step__actor-lit absolute inset-0 -z-10 rounded-full bg-mint ring-1 ring-emerald-200"
                        aria-hidden="true"
                      />
                      <Icon className="size-4" aria-hidden="true" />
                      {t(actor.label)}
                    </span>
                    <span className="font-medium text-slate-500">
                      {t("marketing.howStep", { n: formatNumber(index + 1) })}
                    </span>
                  </p>
                  <h3 className="mt-3 max-w-[34ch] text-lg leading-snug font-bold text-slate-900 sm:text-xl">
                    {t(step.title)}
                  </h3>
                  <p className="mt-2 max-w-[52ch] leading-relaxed text-slate-600">{t(step.text)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
}
