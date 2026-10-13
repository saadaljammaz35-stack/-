import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookCheck,
  Bot,
  CalendarClock,
  Headset,
  Info,
  MessageCircle,
  Siren,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "./motion";
import {
  FINAL_STAGE,
  ROUTES,
  SCENARIOS,
  routeFor,
  routeIndex,
  routeInfo,
  stageTimeline,
  trunkDelay,
  trunkFill,
  type RouteId,
  type ScenarioId,
  type Stage,
} from "./routing";
import { Section, SectionHeading } from "./Section";
import { container } from "./styles";

const ROUTE_ICONS: Record<RouteId, LucideIcon> = {
  answer: BookCheck,
  booking: CalendarClock,
  handoff: Headset,
  emergency: Siren,
};

/** Horizontal position of the vertical connectors: the centre of the 44px icons. */
const AXIS = "start-[calc(1.375rem-1px)]";

function delayStyle(ms: number, scale?: number): CSSProperties {
  return {
    "--mk-route-delay": `${ms}ms`,
    ...(scale === undefined ? {} : { "--mk-route-scale": scale }),
  } as CSSProperties;
}

/**
 * "See how the assistant responds": the visitor picks a sample message and an
 * animated route shows which path CliniBot takes. A fixed illustration of the
 * routing rules, labelled as such; nothing is sent anywhere.
 */
export function RoutingDemo() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<ScenarioId | null>(null);
  const [stage, setStage] = useState<Stage>(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  function choose(id: ScenarioId) {
    clearTimers();
    setSelected(id);
    for (const { stage: next, at } of stageTimeline(reduced)) {
      if (at === 0) setStage(next);
      else timers.current.push(window.setTimeout(() => setStage(next), at));
    }
  }

  // Reduced motion (even if switched on mid-animation) shows the final state.
  const shown: Stage = selected ? (reduced ? FINAL_STAGE : stage) : 0;
  const route = selected ? routeFor(selected) : null;
  const chosenIndex = route ? routeIndex(route) : -1;
  const done = shown >= FINAL_STAGE;
  const branchDelay = trunkDelay(Math.max(chosenIndex, 0)) + 300;
  const scenario = SCENARIOS.find((item) => item.id === selected);

  return (
    <Section id="try" labelledBy="demo-title" className="py-16 sm:py-24">
      <div
        className={cn(
          container,
          "grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14",
        )}
      >
        <div className="flex flex-col gap-6">
          <SectionHeading
            id="demo-title"
            kicker={t("marketing.demoKicker")}
            title={t("marketing.demoTitle")}
            intro={t("marketing.demoIntro")}
          />
          <div role="group" aria-labelledby="demo-pick-label" className="flex flex-col gap-2.5">
            <p id="demo-pick-label" className="text-sm font-bold text-slate-700">
              {t("marketing.demoPickLabel")}
            </p>
            {SCENARIOS.map((item) => {
              const pressed = selected === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={pressed}
                  aria-controls="demo-result"
                  onClick={() => choose(item.id)}
                  className={cn(
                    "mk-btn flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-start text-base font-medium ring-1",
                    pressed
                      ? "bg-primary text-white ring-primary"
                      : "bg-white/90 text-slate-800 ring-slate-200 [--mk-btn-wash:rgb(15_76_129/0.05)]",
                  )}
                >
                  <MessageCircle
                    className={cn("size-5 shrink-0", pressed ? "text-emerald-200" : "text-primary")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{t(item.message)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white/90 p-5 shadow-card ring-1 ring-slate-200 sm:p-7">
          <p className="mb-5 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-200">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            {t("marketing.demoDisclaimer")}
          </p>

          {/* 1. the patient's message */}
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-bold text-slate-600">{t("marketing.demoNodeIn")}</p>
              {scenario && shown >= 1 ? (
                <p
                  key={`${scenario.id}-${String(reduced)}`}
                  className={cn(
                    "mt-1.5 w-fit max-w-full rounded-2xl rounded-ss-md bg-[#D7F4E6] px-3.5 py-2 text-base text-slate-900",
                    !reduced && "mk-fade-in",
                  )}
                >
                  {t(scenario.message)}
                </p>
              ) : (
                <p className="mt-1.5 text-base text-slate-500">{t("marketing.demoNodeInEmpty")}</p>
              )}
            </div>
          </div>

          <Connector on={shown >= 2} />

          {/* 2. CliniBot */}
          <div className="flex items-center gap-3">
            <span className="relative isolate flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <span
                className="mk-live mk-live--breathe absolute -inset-1.5 -z-10 rounded-full bg-mint"
                aria-hidden="true"
              />
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <p className="font-bold text-slate-900">{t("marketing.demoNodeBot")}</p>
          </div>

          <Connector on={done} />

          {/* 3. the possible paths */}
          <p id="demo-routes-label" className="sr-only">
            {t("marketing.demoRoutesLabel")}
          </p>
          <ul aria-labelledby="demo-routes-label">
            {ROUTES.map((item, index) => {
              const Icon = ROUTE_ICONS[item.id];
              const chosen = done && index === chosenIndex;
              const fill = done ? trunkFill(index, chosenIndex, ROUTES.length) : 0;
              const last = index === ROUTES.length - 1;
              return (
                <li key={item.id} className="relative flex items-center ps-[calc(1.375rem-1px)]">
                  <span
                    className={cn(
                      "absolute top-0 w-0.5 overflow-hidden bg-slate-200",
                      AXIS,
                      last ? "bottom-1/2" : "bottom-0",
                    )}
                    aria-hidden="true"
                  >
                    <span
                      className="mk-route__fill absolute inset-0 bg-accent"
                      data-on={fill > 0 ? "true" : "false"}
                      style={delayStyle(trunkDelay(index), fill)}
                    />
                  </span>
                  <span
                    className="relative h-0.5 w-5 shrink-0 overflow-hidden bg-slate-200"
                    aria-hidden="true"
                  >
                    <span
                      className="mk-route__branch absolute inset-0 bg-accent"
                      data-on={chosen ? "true" : "false"}
                      style={delayStyle(branchDelay)}
                    />
                  </span>
                  <div className="relative isolate my-1.5 flex min-h-12 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 ring-1 ring-slate-200">
                    <span
                      className="mk-route__lit absolute inset-0 -z-10 rounded-xl bg-mint ring-2 ring-accent"
                      data-on={chosen ? "true" : "false"}
                      style={delayStyle(branchDelay + 160)}
                      aria-hidden="true"
                    />
                    <span
                      className="mk-route__dim flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
                      data-dim={done && !chosen ? "true" : "false"}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    <span
                      className={cn(
                        "text-[0.9375rem] leading-snug text-slate-800",
                        chosen && "font-bold text-slate-900",
                      )}
                    >
                      {t(item.label)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 4. what happens */}
          <div
            id="demo-result"
            aria-live="polite"
            className="mt-5 rounded-2xl bg-canvas p-4 ring-1 ring-slate-200"
          >
            {done && route ? (
              <div key={`${route}-${String(reduced)}`} className={cn(!reduced && "mk-fade-in")}>
                <p className="font-bold text-slate-900">{t("marketing.demoResultTitle")}</p>
                <p className="sr-only">
                  {t("marketing.demoSelected", { route: t(routeInfo(route).label) })}
                </p>
                <p className="mt-1.5 max-w-[60ch] leading-relaxed text-slate-700">
                  {t(routeInfo(route).result)}
                </p>
              </div>
            ) : (
              <p className="leading-relaxed text-slate-600">{t("marketing.demoIdle")}</p>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Connector({ on }: { on: boolean }) {
  return (
    <div className="relative h-6" aria-hidden="true">
      <span className={cn("absolute inset-y-0 w-0.5 overflow-hidden bg-slate-200", AXIS)}>
        <span
          className="mk-route__fill absolute inset-0 bg-accent"
          data-on={on ? "true" : "false"}
        />
      </span>
    </div>
  );
}
