import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleOff, RotateCcw } from "lucide-react";
import { QueryError } from "@/components/layout/QueryError";
import { Alert, Button, ButtonLink, ConfirmDialog, EmptyState, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { isApiError } from "@/lib/api";
import { errorReference, errorText } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { isValidSlug } from "@/lib/validation";
import { ChatHeader, EmergencyLine } from "./ChatHeader";
import { ConnectionNotice, ConversationNotice } from "./ChatNotices";
import { fetchProfile } from "./chatApi";
import { Composer } from "./Composer";
import { ConsentScreen } from "./ConsentScreen";
import { MessageList, type TypingKind } from "./MessageList";
import { checkDraft, conversationNotice, restoreDraft } from "./model";
import type { ChatProfile, ChatSender } from "./types";
import { useChatSession } from "./useChatSession";
import { useVisualViewport, type ViewportBox } from "./useVisualViewport";

/** Fallback while the clinic's own number is unknown (Saudi Red Crescent). */
const DEFAULT_EMERGENCY_NUMBER = "997";
/** Long messages are shortened in the screen-reader announcement (the full text is on screen). */
const ANNOUNCE_MAX_CHARS = 400;

function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/**
 * Full-height frame that follows the visible viewport, so the composer stays
 * above the iPhone keyboard. Falls back to 100dvh without visualViewport.
 */
function ChatFrame({ box, children }: { box: ViewportBox | null; children: ReactNode }) {
  const style: CSSProperties | undefined = box
    ? {
        height: `${box.height}px`,
        ...(box.offsetTop ? { transform: `translateY(${box.offsetTop}px)` } : {}),
      }
    : undefined;
  return (
    <div
      className="fixed inset-x-0 top-0 flex h-dvh flex-col overflow-hidden bg-canvas"
      style={style}
    >
      {children}
    </div>
  );
}

/** Uses the clinic's language unless the visitor already picked one. */
function useClinicDefaultLanguage(profile: ChatProfile | null) {
  const { lang, setLang } = useI18n();
  const appliedRef = useRef(false);
  useEffect(() => {
    if (!profile || appliedRef.current) return;
    appliedRef.current = true;
    if (safeStorage.get(STORAGE_KEYS.lang) !== null) return;
    if (profile.default_language === lang) return;
    setLang(profile.default_language);
    // setLang() remembers the choice; this one was the clinic's default, not the visitor's.
    safeStorage.remove(STORAGE_KEYS.lang);
  }, [profile, lang, setLang]);
}

function MessagesSkeleton() {
  const { t } = useI18n();
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t("chat.loading")}</span>
      <Skeleton className="mx-auto h-20 w-full max-w-md rounded-2xl" />
      <Skeleton className="ms-auto h-11 w-2/3 max-w-xs rounded-2xl" />
      <Skeleton className="h-16 w-3/4 max-w-sm rounded-2xl" />
      <Skeleton className="ms-auto h-11 w-1/2 max-w-xs rounded-2xl" />
    </div>
  );
}

function ErrorWithReference({ error }: { error: unknown }) {
  const { t, tRich } = useI18n();
  const reference = errorReference(error);
  return (
    <>
      {errorText(t, error)}
      {reference && (
        <span className="mt-1 block text-xs font-normal opacity-80">
          {tRich("errors.reference", {
            id: (
              <span dir="ltr" className="font-mono select-all">
                {reference}
              </span>
            ),
          })}
        </span>
      )}
    </>
  );
}

/** The patient web chat for one clinic (/c/:slug). */
export function PatientChat({ slug }: { slug: string }) {
  const { t } = useI18n();
  const validSlug = isValidSlug(slug);
  const profileQuery = useQuery({
    queryKey: ["public-chat", slug, "profile"],
    queryFn: ({ signal }) => fetchProfile(slug, signal),
    enabled: validSlug,
  });
  const profile = profileQuery.data ?? null;
  const notFound = !validSlug || (!profile && isNotFound(profileQuery.error));
  const box = useVisualViewport();

  useDocumentTitle(profile?.name ?? t("chat.title"));
  useClinicDefaultLanguage(profile);

  if (profile) {
    return (
      <ChatFrame box={box}>
        <Conversation profile={profile} slug={slug} box={box} />
      </ChatFrame>
    );
  }

  const failed = !notFound && profileQuery.error !== null;
  return (
    <ChatFrame box={box}>
      <ChatHeader profile={null} loading={!notFound && !failed} />
      <EmergencyLine number={DEFAULT_EMERGENCY_NUMBER} />
      <main id="main" className="min-h-0 flex-1 overflow-y-auto ps-safe pe-safe pb-safe">
        <div className="mx-auto w-full max-w-xl px-4 py-6">
          {notFound ? (
            <EmptyState
              icon={MessageCircleOff}
              title={t("chat.notFoundTitle")}
              text={t("chat.notFoundText")}
              action={
                <ButtonLink to="/" variant="outline">
                  {t("chat.notFoundHome")}
                </ButtonLink>
              }
              className="py-10"
            />
          ) : failed ? (
            <QueryError
              error={profileQuery.error}
              onRetry={() => void profileQuery.refetch()}
              retrying={profileQuery.isFetching}
            />
          ) : (
            <MessagesSkeleton />
          )}
        </div>
      </main>
    </ChatFrame>
  );
}

function Conversation({
  profile,
  slug,
  box,
}: {
  profile: ChatProfile;
  slug: string;
  box: ViewportBox | null;
}) {
  const { t, tRich, lang } = useI18n();
  const [draft, setDraft] = useState("");
  const session = useChatSession({
    slug,
    lang,
    // A message reported as failed reached the clinic after all: drop the text put back for Resend.
    onDeliveredLate: (body) => setDraft((current) => (current.trim() === body ? "" : current)),
  });
  const { phase, state } = session;
  const [dialog, setDialog] = useState<"delete" | "new" | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  /** Follow new messages unless the visitor scrolled up to read. */
  const stickRef = useRef(true);
  /** Move focus to the composer once the chat opens after consent. */
  const focusComposerRef = useRef(false);

  const notice = conversationNotice(state.status, state.aiPaused, profile.assistant_available);
  const assistantWillAnswer =
    profile.assistant_available && !state.aiPaused && state.status !== "awaiting_human";
  const typing: TypingKind = session.sending
    ? assistantWillAnswer
      ? "assistant"
      : "sending"
    : null;
  const paused = session.cooldownUntil !== null;

  // Focus: composer after consent; the consent heading after a chat ends.
  useEffect(() => {
    if (phase === "ready" && focusComposerRef.current) {
      focusComposerRef.current = false;
      textareaRef.current?.focus();
      return;
    }
    if (phase === "consent" && session.endedBecause) {
      const frame = requestAnimationFrame(() => headingRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [phase, session.endedBecause]);

  // Keep the newest message in view (also when the keyboard resizes the frame).
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || phase === "consent") return;
    if (stickRef.current) element.scrollTop = element.scrollHeight;
  }, [phase, state.messages, typing, notice, session.pollError, box?.height]);

  // Consent screen starts at the top.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (phase === "consent" && element) element.scrollTop = 0;
    stickRef.current = true;
  }, [phase]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  }

  async function handleStart() {
    focusComposerRef.current = true;
    const ok = await session.start();
    if (!ok) focusComposerRef.current = false;
  }

  async function handleSend() {
    const text = draft;
    if (!checkDraft(text).ok || session.sending) return;
    const hadFocus = document.activeElement === textareaRef.current;
    setDraft("");
    stickRef.current = true;
    const ok = await session.send(text);
    if (!ok) {
      setDraft((current) => restoreDraft(text, current));
      textareaRef.current?.focus();
    } else if (hadFocus) {
      textareaRef.current?.focus();
    }
  }

  const assistantName = profile.assistant_name;
  const announcement = useMemo(() => {
    const label = (sender: ChatSender) =>
      sender === "staff"
        ? t("chat.clinicTeam")
        : sender === "system"
          ? t("chat.systemNotice")
          : assistantName;
    return state.arrivals
      .map((message) =>
        t("chat.newMessage", {
          sender: label(message.sender),
          text:
            message.body.length > ANNOUNCE_MAX_CHARS
              ? `${message.body.slice(0, ANNOUNCE_MAX_CHARS)}…`
              : message.body,
        }),
      )
      .join(" ");
  }, [state.arrivals, t, assistantName]);

  const sendError = session.sendError;
  const sendRateLimited = isApiError(sendError) && sendError.status === 429;
  const sendReference = sendError ? errorReference(sendError) : null;

  return (
    <>
      <ChatHeader
        profile={profile}
        onNewChat={phase === "consent" ? undefined : () => setDialog("new")}
        onDeleteChat={
          phase === "consent"
            ? undefined
            : () => {
                setDeleteError(null);
                setDialog("delete");
              }
        }
      />
      <EmergencyLine number={profile.emergency_number} />

      {/* New messages from the clinic side, read out politely. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {/* Keyed by arrival, so a repeated text (e.g. a second emergency notice) is read again. */}
        <span key={state.arrivalSeq}>{announcement}</span>
      </div>

      <main
        ref={scrollRef}
        id="main"
        onScroll={onScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain ps-safe pe-safe",
          phase === "consent" && "pb-safe",
        )}
      >
        {phase === "consent" ? (
          <ConsentScreen
            profile={profile}
            endedBecause={session.endedBecause}
            persistent={session.persistent}
            starting={session.starting}
            startError={session.startError}
            onStart={() => void handleStart()}
            headingRef={headingRef}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-4">
            {!session.persistent && (
              <Alert tone="warning" live={false}>
                {t("chat.storageUnavailable")}
              </Alert>
            )}

            {phase === "loading" ? (
              session.pollError ? (
                <QueryError
                  error={session.pollError}
                  onRetry={session.retryPoll}
                  className="mt-2"
                />
              ) : (
                <MessagesSkeleton />
              )
            ) : (
              <>
                {state.messages.length === 0 && !typing ? (
                  <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-600 shadow-card">
                    {t("chat.emptyHistory")}
                  </p>
                ) : (
                  <MessageList messages={state.messages} profile={profile} typing={typing} />
                )}
                {notice && <ConversationNotice kind={notice} profile={profile} />}
                {session.pollError !== null && session.pollError !== undefined && (
                  <ConnectionNotice error={session.pollError} onRetry={session.retryPoll} />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {phase === "ready" && (
        <footer
          className={cn(
            "shrink-0 border-t border-slate-200 bg-white ps-safe pe-safe",
            !box?.keyboardOpen && "pb-safe",
          )}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-3 pt-2.5 pb-2 sm:px-4">
            {session.sendUnconfirmed && (sendError === null || sendError === undefined) && (
              <Alert tone="info">{t("chat.sendUnconfirmed")}</Alert>
            )}
            {sendError !== null && sendError !== undefined && (
              <Alert
                tone={sendRateLimited || session.sendUncertain ? "warning" : "error"}
                title={session.sendUncertain ? t("chat.sendUncertain") : t("chat.sendFailed")}
                action={
                  sendRateLimited ? undefined : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!checkDraft(draft).ok || session.sending || paused}
                      onClick={() => void handleSend()}
                      icon={<RotateCcw className="size-4" aria-hidden="true" />}
                    >
                      {t("chat.resend")}
                    </Button>
                  )
                }
              >
                {session.sendUncertain ? (
                  <>
                    <p>{t("chat.sendUncertainHint")}</p>
                    {sendReference && (
                      <p className="mt-1 text-xs opacity-80">
                        {tRich("errors.reference", {
                          id: (
                            <span dir="ltr" className="font-mono select-all">
                              {sendReference}
                            </span>
                          ),
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      <ErrorWithReference error={sendError} />
                    </p>
                    <p className="mt-1">{t("chat.sendFailedKept")}</p>
                  </>
                )}
              </Alert>
            )}
            <Composer
              value={draft}
              onChange={setDraft}
              onSubmit={() => void handleSend()}
              sending={session.sending}
              pausedUntil={session.cooldownUntil}
              textareaRef={textareaRef}
            />
          </div>
        </footer>
      )}

      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => {
          setDialog(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          const error = await session.deleteConversation();
          if (error) {
            setDeleteError(error);
            return;
          }
          setDraft("");
          setDialog(null);
        }}
        title={t("chat.deleteTitle")}
        description={t("chat.deleteText")}
        confirmLabel={t("chat.deleteConfirm")}
        tone="danger"
        error={deleteError ? <ErrorWithReference error={deleteError} /> : undefined}
      />

      <ConfirmDialog
        open={dialog === "new"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          session.leave();
          setDraft("");
          setDialog(null);
        }}
        title={t("chat.newChatTitle")}
        description={t("chat.newChatText")}
        confirmLabel={t("chat.newChatConfirm")}
        tone="primary"
      />
    </>
  );
}
