import type { CSSProperties } from "react";
import { SendHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { Reveal } from "./Reveal";

const CONVERSATION: ReadonlyArray<{ from: "patient" | "assistant"; text: MessageKey }> = [
  { from: "patient", text: "marketing.mockMsg1" },
  { from: "assistant", text: "marketing.mockMsg2" },
  { from: "patient", text: "marketing.mockMsg3" },
  { from: "assistant", text: "marketing.mockMsg4" },
];

/**
 * A phone drawn in HTML/CSS showing an EXAMPLE conversation, labelled as one
 * both visibly and for screen readers. Nothing here is a real AI reply.
 */
export function PhoneMock({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <figure
      aria-labelledby="mock-caption"
      className={cn("relative mx-auto w-full max-w-[20rem] sm:max-w-[21.5rem]", className)}
    >
      <figcaption id="mock-caption" className="sr-only">
        {t("marketing.mockCaption")}
      </figcaption>

      <div
        className="mk-live mk-live--float"
        style={{ "--mk-live-duration": "6.5s" } as CSSProperties}
      >
        <div className="rounded-[2.6rem] bg-navy-950 p-2.5 shadow-[0_30px_60px_-28px_rgb(6_29_51/0.55)] ring-1 ring-navy-900">
          <div className="overflow-hidden rounded-[2.1rem] bg-[#EEF4F2]">
            {/* status bar with the notch */}
            <div className="flex h-7 items-center justify-center bg-white" aria-hidden="true">
              <span className="h-4 w-24 rounded-full bg-navy-950" />
            </div>

            {/* chat header */}
            <div className="flex items-center gap-2.5 border-b border-slate-200/80 bg-white px-3.5 pb-3">
              <LogoMark size={34} title="" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[0.9375rem] font-bold text-slate-900">
                  {t("marketing.mockClinic")}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {t("marketing.mockStatus")}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                {t("marketing.mockLabel")}
              </span>
            </div>

            {/* messages */}
            <Reveal as="ol" items={CONVERSATION.length} className="flex flex-col gap-2.5 px-3 py-4">
              {CONVERSATION.map((message, index) => {
                const patient = message.from === "patient";
                return (
                  <li
                    key={message.text}
                    data-reveal=""
                    style={revealStyle(index + 1)}
                    className={cn(
                      "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed shadow-[0_1px_1px_rgb(15_23_42/0.06)]",
                      patient
                        ? "self-end rounded-ee-md bg-[#D7F4E6] text-slate-900"
                        : "self-start rounded-es-md bg-white text-slate-900",
                    )}
                  >
                    <span className="sr-only">
                      {t(patient ? "marketing.mockPatient" : "marketing.mockAssistant")}{" "}
                    </span>
                    {t(message.text)}
                  </li>
                );
              })}
            </Reveal>

            {/* input bar (decorative) */}
            <div className="flex items-center gap-2 bg-white px-3 py-2.5" aria-hidden="true">
              <span className="flex-1 truncate rounded-full bg-slate-100 px-3.5 py-2 text-sm text-slate-500">
                {t("marketing.mockInput")}
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
                <SendHorizontal className="flip-rtl size-4" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-[40ch] text-center text-sm leading-relaxed text-slate-600">
        {t("marketing.mockNote")}
      </p>
    </figure>
  );
}
