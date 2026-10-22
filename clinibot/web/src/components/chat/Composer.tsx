import { useId, useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { MAX_MESSAGE_LENGTH, checkDraft } from "./model";

/** Counter digits without thousands separators ("999/1000"). */
const PLAIN: Intl.NumberFormatOptions = { useGrouping: false };

/** About six lines; beyond that the textarea scrolls. */
const MAX_TEXTAREA_HEIGHT_PX = 168;

/** Enter sends only with a real keyboard and mouse; on phones Enter is a new line. */
function enterSends(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with a draft that passed checkDraft(). */
  onSubmit: () => void;
  sending: boolean;
  /** Sending is paused until this time (ms), e.g. after "too many requests"; typing still works. */
  pausedUntil: number | null;
  /** The page focuses the textarea after consent and after a failed send. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  sending,
  pausedUntil,
  textareaRef,
}: ComposerProps) {
  const { t, formatNumber, formatDate, dir } = useI18n();
  const paused = pausedUntil !== null;
  const id = useId();
  const counterId = `${id}-count`;
  const hintId = `${id}-hint`;
  const check = checkDraft(value);
  const tooLong = check.problem === "too_long";
  const canSend = check.ok && !sending && !paused;

  // Grow with the text, up to a limit.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [value, textareaRef]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (canSend) onSubmit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!enterSends()) return;
    event.preventDefault();
    submit();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          {t("chat.composerLabel")}
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          // An empty dir="auto" control resolves to LTR (the placeholder is ignored), so follow
          // the page direction until there is text to detect from.
          dir={value ? "auto" : dir}
          placeholder={t("chat.composerPlaceholder")}
          autoComplete="off"
          enterKeyHint="enter"
          aria-invalid={tooLong || undefined}
          aria-describedby={`${hintId} ${counterId}`}
          className={cn(
            "block max-h-42 min-h-11 w-full min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-base leading-normal text-slate-900",
            "placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-hidden",
            "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20",
          )}
        />
        <Button
          type="submit"
          className="size-11 shrink-0 rounded-full px-0 sm:w-auto sm:rounded-xl sm:px-4"
          disabled={!canSend}
          loading={sending}
          aria-label={t("chat.send")}
          // Keep focus (and the phone keyboard) in the textarea when tapping send.
          onMouseDown={(event) => event.preventDefault()}
          icon={
            sending ? undefined : <SendHorizontal className="size-5 flip-rtl" aria-hidden="true" />
          }
        >
          <span className="sr-only sm:not-sr-only">{t("chat.send")}</span>
        </Button>
      </div>
      <div className="flex min-h-5 items-start justify-between gap-3 px-1 text-xs">
        <p id={hintId} className="min-w-0 text-slate-500">
          {tooLong ? (
            <span className="font-medium text-red-700">
              {t("chat.tooLong", { max: formatNumber(MAX_MESSAGE_LENGTH) })}
            </span>
          ) : paused ? (
            <span className="text-amber-800">
              {t("chat.cooldown", {
                // Rounded up to the minute: a clock time, so the hint needs no ticking.
                time: formatDate(Math.ceil(pausedUntil / 60_000) * 60_000, {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </span>
          ) : (
            <span className="hidden pointer-fine:inline">{t("chat.keyboardHint")}</span>
          )}
        </p>
        <p
          id={counterId}
          className={cn(
            "shrink-0 tabular-nums",
            tooLong ? "font-bold text-red-700" : "text-slate-500",
          )}
        >
          <span aria-hidden="true" dir="ltr">
            {`${formatNumber(check.length, PLAIN)}/${formatNumber(MAX_MESSAGE_LENGTH, PLAIN)}`}
          </span>
          <span className="sr-only">
            {t("chat.charCount", {
              count: formatNumber(check.length),
              max: formatNumber(MAX_MESSAGE_LENGTH),
            })}
          </span>
        </p>
      </div>
    </form>
  );
}
