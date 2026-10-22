import { useId, useRef, useState, type FormEvent, type Ref } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { QueryError } from "@/components/layout/QueryError";
import { Alert, Button, Checkbox } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import type { SessionEnd } from "./useChatSession";
import type { ChatProfile } from "./types";

const ENDED_TEXT: Record<SessionEnd, MessageKey> = {
  deleted: "chat.noticeDeleted",
  expired: "chat.noticeExpired",
  left: "chat.noticeLeft",
};

export interface ConsentScreenProps {
  profile: ChatProfile;
  endedBecause: SessionEnd | null;
  persistent: boolean;
  starting: boolean;
  startError: unknown;
  onStart: () => void;
  /** Receives focus when the visitor comes back here after deleting or losing a chat. */
  headingRef: Ref<HTMLHeadingElement>;
}

/** The clinic's privacy notice and a required consent before the first message. */
export function ConsentScreen({
  profile,
  endedBecause,
  persistent,
  starting,
  startError,
  onStart,
  headingRef,
}: ConsentScreenProps) {
  const { t, tRich, lang } = useI18n();
  const headingId = useId();
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const notice = profile.privacy_notice[lang].trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (starting) return;
    if (!accepted) {
      setShowError(true);
      checkboxRef.current?.focus();
      return;
    }
    onStart();
  }

  const points: string[] = [
    t("chat.pointStored"),
    t("chat.pointDelete"),
    t("chat.pointNotDoctor"),
    t("chat.pointEmergency", { number: profile.emergency_number }),
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-5 sm:py-8">
      {endedBecause && (
        <Alert tone={endedBecause === "deleted" ? "success" : "info"}>
          {t(ENDED_TEXT[endedBecause])}
        </Alert>
      )}

      <section
        aria-labelledby={headingId}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint text-accent-strong">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="text-lg font-extrabold text-slate-900 outline-none"
          >
            {t("chat.consentTitle")}
          </h2>
        </div>

        {notice && (
          <>
            <p className="mt-4 text-sm text-slate-600">
              {t("chat.consentIntro", { clinic: profile.name })}
            </p>
            <div
              role="region"
              aria-label={t("chat.noticeHeading")}
              tabIndex={0}
              dir="auto"
              className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-line text-slate-800 [overflow-wrap:anywhere]"
            >
              {notice}
            </div>
          </>
        )}

        <h3 className="mt-5 text-sm font-extrabold text-slate-900">{t("chat.pointsTitle")}</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-sm leading-relaxed text-slate-700"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-slate-600">
          {tRich("chat.privacyMore", {
            link: (
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary underline underline-offset-2"
              >
                {t("chat.privacyLink")}
                <span className="sr-only"> {t("common.opensInNewTab")}</span>
              </a>
            ),
          })}
        </p>

        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
          <Checkbox
            ref={checkboxRef}
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              if (event.target.checked) setShowError(false);
            }}
            required
            aria-required="true"
            label={t("chat.consentCheckbox")}
            error={showError ? t("chat.consentRequired") : undefined}
          />
          {startError !== null && startError !== undefined && <QueryError error={startError} />}
          <Button type="submit" size="lg" fullWidth loading={starting}>
            {t("chat.startChat")}
          </Button>
        </form>
      </section>

      {!persistent && (
        <Alert tone="warning" live={false}>
          {t("chat.storageUnavailable")}
        </Alert>
      )}
    </div>
  );
}
