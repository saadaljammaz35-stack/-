import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, RotateCcw, SendHorizontal } from "lucide-react";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Textarea,
} from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { useServices } from "@/components/knowledge/queries";
import {
  buildTestMessages,
  MAX_MESSAGE_CHARS,
  MAX_TEST_MESSAGES,
  type ChatTurn,
  type SystemStatus,
} from "./model";
import { useAssistantTest } from "./queries";
import { TestError } from "./TestError";
import { TestReply } from "./TestReply";

/** Suggested first messages, one per behaviour worth checking. */
const SUGGESTIONS: ReadonlyArray<{ label: MessageKey; prompt: MessageKey }> = [
  { label: "assistant.chipPrice", prompt: "assistant.promptPrice" },
  { label: "assistant.chipHours", prompt: "assistant.promptHours" },
  { label: "assistant.chipBooking", prompt: "assistant.promptBooking" },
  { label: "assistant.chipMedical", prompt: "assistant.promptMedical" },
  { label: "assistant.chipEmergency", prompt: "assistant.promptEmergency" },
];

/**
 * A real conversation with the assistant against the clinic's saved
 * knowledge. Nothing is stored and no appointment is created, but each reply
 * is a real AI call that counts toward the monthly allowance.
 */
export function TestConsole({
  orgId,
  status,
}: {
  orgId: string;
  status: SystemStatus | undefined;
}) {
  const { t, formatNumber, dir } = useI18n();
  const test = useAssistantTest(orgId);
  const services = useServices(orgId);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<unknown>(null);
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const hintId = useId();

  const notConfigured = status?.ai.configured === false;
  const entitlements = status?.entitlements ?? null;
  const subscriptionInactive = entitlements !== null && !entitlements.isActive;
  const quotaExhausted =
    entitlements !== null && entitlements.isActive && entitlements.aiRemaining === 0;
  const blocked = notConfigured || subscriptionInactive || quotaExhausted;
  const tooLong = draft.trim().length > MAX_MESSAGE_CHARS;
  const canSend = !blocked && !test.isPending && draft.trim() !== "" && !tooLong;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns.length, test.isPending]);

  function newId() {
    nextId.current += 1;
    return `turn-${nextId.current}`;
  }

  function send() {
    const content = draft.trim();
    if (!canSend) return;
    const userTurn: ChatTurn = { id: newId(), role: "user", content };
    const next = [...turns, userTurn];
    setTurns(next);
    setDraft("");
    setError(null);
    test.mutate(buildTestMessages(next), {
      onSuccess: (result) =>
        setTurns((current) => [
          ...current,
          { id: newId(), role: "assistant", content: result.reply, result },
        ]),
      onError: (failure) => {
        // Take the message back out of the transcript and into the box so it can be resent.
        setTurns((current) => current.filter((turn) => turn.id !== userTurn.id));
        setDraft(content);
        setError(failure);
      },
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on keyboards with a fine pointer; on phones Enter adds a line and the button sends.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (touch && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    send();
  }

  function applySuggestion(prompt: MessageKey) {
    setDraft(t(prompt));
    inputRef.current?.focus();
  }

  function reset() {
    setTurns([]);
    setError(null);
    test.reset();
    inputRef.current?.focus();
  }

  return (
    <Card as="section" aria-labelledby="assistant-test-title" className="flex flex-col">
      <CardHeader
        title={<span id="assistant-test-title">{t("assistant.testTitle")}</span>}
        description={t("assistant.testDescription")}
        actions={
          turns.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={test.isPending}
              icon={<RotateCcw className="size-4" aria-hidden="true" />}
            >
              {t("assistant.testClear")}
            </Button>
          ) : null
        }
      />
      <CardBody className="flex flex-col gap-4">
        <Alert tone="info">
          {t("assistant.testAllowanceNote")}
          {entitlements?.aiLimit !== null && entitlements?.aiLimit !== undefined && (
            <>
              {" "}
              {t("assistant.testAllowanceUsage", {
                used: formatNumber(entitlements.aiUsed ?? 0),
                limit: formatNumber(entitlements.aiLimit),
              })}
            </>
          )}
        </Alert>

        {notConfigured && (
          <Alert tone="warning" live={false}>
            {t("assistant.testBlockedConfig")}
          </Alert>
        )}
        {(subscriptionInactive || quotaExhausted) && (
          <Alert
            tone="warning"
            title={t("assistant.testBillingTitle")}
            action={
              <ButtonLink to="/app/billing" size="sm" variant="outline">
                {t("assistant.goToBilling")}
              </ButtonLink>
            }
          >
            {subscriptionInactive
              ? t("assistant.subscriptionInactiveText")
              : t("assistant.quotaExhaustedText")}
          </Alert>
        )}

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={t("assistant.testLogLabel")}
          tabIndex={0}
          className="flex max-h-[min(60dvh,36rem)] min-h-48 flex-col gap-3 overflow-y-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4"
        >
          {turns.length === 0 && !test.isPending ? (
            <div className="m-auto flex max-w-sm flex-col items-center px-2 py-6 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-mint text-accent-strong">
                <Bot className="size-6" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-slate-600">{t("assistant.testEmpty")}</p>
            </div>
          ) : (
            turns.map((turn) =>
              turn.role === "user" ? (
                <div
                  key={turn.id}
                  className="max-w-[85%] self-end rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-white"
                >
                  <span className="sr-only">{t("assistant.youSaid")} </span>
                  {/* dir="auto" on the message only: the hidden label must not decide it. */}
                  <p dir="auto">{turn.content}</p>
                </div>
              ) : (
                <div
                  key={turn.id}
                  className="w-full max-w-[min(100%,36rem)] self-start rounded-2xl rounded-es-md bg-white px-4 py-3 ring-1 ring-slate-200"
                >
                  <span className="sr-only">{t("assistant.assistantSaid")} </span>
                  {turn.result ? (
                    <TestReply result={turn.result} services={services.data} />
                  ) : (
                    <p dir="auto">{turn.content}</p>
                  )}
                </div>
              ),
            )
          )}
          {test.isPending && (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
              <Spinner size="sm" />
              {t("assistant.testThinking")}
            </div>
          )}
        </div>

        {error !== null && <TestError error={error} />}

        {turns.length >= MAX_TEST_MESSAGES && (
          <p className="text-[0.8125rem] text-slate-600">
            {t("assistant.testWindowNote", { max: formatNumber(MAX_TEST_MESSAGES) })}
          </p>
        )}

        <div>
          <p className="mb-2 text-[0.8125rem] font-bold text-slate-700" id={`${inputId}-chips`}>
            {t("assistant.testSuggestions")}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${inputId}-chips`}>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                disabled={blocked || test.isPending}
                onClick={() => applySuggestion(suggestion.prompt)}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(suggestion.label)}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-bold text-slate-800">
            {t("assistant.testInputLabel")}
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              id={inputId}
              rows={2}
              // Empty dir="auto" resolves to LTR; follow the page until there is text.
              dir={draft ? "auto" : dir}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={blocked}
              enterKeyHint="send"
              aria-describedby={hintId}
              aria-invalid={tooLong || undefined}
              className="max-h-40 min-h-12 resize-y"
            />
            <Button
              type="submit"
              disabled={!canSend}
              loading={test.isPending}
              aria-label={t("assistant.testSend")}
              className="size-12 px-0"
              icon={
                test.isPending ? undefined : (
                  <SendHorizontal className="flip-rtl size-5" aria-hidden="true" />
                )
              }
            />
          </div>
          <p
            id={hintId}
            className={cn("text-xs", tooLong ? "font-bold text-red-700" : "text-slate-500")}
          >
            {t("assistant.testInputHint", {
              count: formatNumber(draft.trim().length),
              max: formatNumber(MAX_MESSAGE_CHARS),
            })}
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
