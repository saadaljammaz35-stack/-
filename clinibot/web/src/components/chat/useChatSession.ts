import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Lang } from "@/i18n";
import { isApiError } from "@/lib/api";
import { deleteChat, pollChat, sendChatMessage, startChat } from "./chatApi";
import { chatReducer, initialChatState, type ChatState } from "./chatState";
import { MAX_POLL_BACKOFF_MS, POLL_INTERVAL_MS, pollCursor } from "./model";
import { sharedTokenStore, type TokenStore } from "./sessionStore";
import type { ChatMessage, TimelineMessage } from "./types";

/** consent: no session yet · loading: continuing a stored session · ready: chatting. */
export type ChatPhase = "consent" | "loading" | "ready";

/** Why the consent screen is shown again. */
export type SessionEnd = "deleted" | "expired" | "left";

export interface ChatSession {
  phase: ChatPhase;
  state: ChatState;
  /** False when the token could only be kept in memory (refresh ends the chat). */
  persistent: boolean;
  endedBecause: SessionEnd | null;

  start: () => Promise<boolean>;
  starting: boolean;
  startError: unknown;

  /** Resolves false when the message was not sent (the caller keeps the draft). */
  send: (text: string) => Promise<boolean>;
  sending: boolean;
  sendError: unknown;
  /**
   * A send got no answer (timeout, dropped connection, server error) and is
   * being checked against the server: the message may already be delivered.
   */
  sendUnconfirmed: boolean;
  /**
   * With `sendError`: the server may still have the message (the check found no
   * copy, but the request was not refused). Say "couldn't confirm", not "not sent".
   */
  sendUncertain: boolean;
  /** Set after a 429 on send: sending is paused until this time (ms). */
  cooldownUntil: number | null;

  /** A poll failure worth showing (repeated, or the first load). */
  pollError: unknown;
  retryPoll: () => void;

  /** Resolves null when deleted, otherwise the error to show. */
  deleteConversation: () => Promise<unknown>;
  deleting: boolean;
  /** Forget this conversation on this device and go back to the consent screen. */
  leave: () => void;
}

function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

function isRateLimited(error: unknown): boolean {
  return isApiError(error) && (error.status === 429 || error.code === "rate_limited");
}

function retryAfterMs(error: unknown, fallbackSeconds: number): number {
  const seconds = isApiError(error) ? error.retryAfterSeconds : null;
  return Math.max(1, Math.ceil(seconds ?? fallbackSeconds)) * 1000;
}

/**
 * The server's retry_after_seconds is its whole rate-limit window, not the time
 * left, so sending pauses at most this long; the next try finds out whether the
 * window has reset (a refused request does not extend it).
 */
const MAX_SEND_COOLDOWN_MS = 60_000;

/** How long (visible time) a send with an unknown outcome waits for its server copy. */
export const SEND_RECONCILE_MS = 30_000;

/**
 * True when the send may have reached the server although no answer came back:
 * no response at all (status 0: timeout, dropped connection, unreadable reply)
 * or a server error (5xx). `send` stores the message before the assistant runs,
 * so only a 4xx is a refusal for sure. The one 5xx raised before the message is
 * stored is the rate limiter being unavailable.
 */
export function sendOutcomeUnknown(error: unknown): boolean {
  if (!isApiError(error)) return true;
  if (error.status === 0) return true;
  if (error.code === "rate_limit_unavailable") return false;
  return error.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A failed send, and how to recognise its server copy if a later poll shows it after all. */
interface SendFailure {
  error: unknown;
  /** The request was not refused: the server may have the message after all. */
  uncertain: boolean;
  body: string;
  /** Server message ids already on screen when it was sent. */
  known: ReadonlySet<string>;
}

function isServerCopy(
  message: ChatMessage | TimelineMessage,
  failure: Pick<SendFailure, "body" | "known">,
): boolean {
  return (
    !("local" in message && message.local) &&
    message.sender === "customer" &&
    message.body.trim() === failure.body &&
    !failure.known.has(message.id)
  );
}

let localCounter = 0;
function localId(): string {
  localCounter += 1;
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `local-${localCounter}-${random}`;
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

interface Options {
  slug: string;
  lang: Lang;
  store?: TokenStore;
  /** Poll interval; tests shorten it. */
  pollInterval?: number;
  /** How long an unanswered send waits for its server copy; tests shorten it. */
  reconcileWindow?: number;
  /**
   * A send reported as failed shows up on the server after all (a later poll
   * brought its copy): the caller can drop the text it put back in the box.
   */
  onDeliveredLate?: (body: string) => void;
}

/**
 * Everything the patient chat does with the `public-chat` function: start
 * (after consent), send, poll every few seconds while the page is visible,
 * delete, and recover when the stored session no longer exists.
 */
export function useChatSession({
  slug,
  lang,
  store = sharedTokenStore(),
  pollInterval = POLL_INTERVAL_MS,
  reconcileWindow = SEND_RECONCILE_MS,
  onDeliveredLate,
}: Options): ChatSession {
  const [token, setToken] = useState<string | null>(() => store.read(slug));
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [persistent, setPersistent] = useState(() => store.persistent);
  const [endedBecause, setEndedBecause] = useState<SessionEnd | null>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [sendFailure, setSendFailure] = useState<SendFailure | null>(null);
  /** Local ids of sends that got no answer and are being checked against the server. */
  const [unconfirmed, setUnconfirmed] = useState<readonly string[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  // Read by the poll loop and async handlers, which outlive a render.
  const messagesRef = useRef(state.messages);
  const tokenRef = useRef(token);
  const pollNowRef = useRef<() => void>(() => {});
  const sendFailureRef = useRef(sendFailure);
  const onDeliveredLateRef = useRef(onDeliveredLate);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    sendFailureRef.current = sendFailure;
    onDeliveredLateRef.current = onDeliveredLate;
  });

  const endSession = useCallback(
    (reason: SessionEnd) => {
      store.clear(slug);
      tokenRef.current = null;
      setToken(null);
      setHistoryLoaded(false);
      dispatch({ type: "reset" });
      setPollError(null);
      setSendFailure(null);
      setUnconfirmed([]);
      setCooldownUntil(null);
      setEndedBecause(reason);
    },
    [slug, store],
  );

  // ── polling ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const sessionToken = token;
    let stopped = false;
    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let failures = 0;

    function schedule(delay: number) {
      clearTimeout(timer);
      if (!stopped && !isHidden()) timer = setTimeout(() => void run(), delay);
    }

    async function run() {
      if (stopped || isHidden() || controller) return;
      const current = new AbortController();
      controller = current;
      // The first poll of a continued session loads its history: shown, not announced.
      const firstLoad = first && messagesRef.current.length === 0;
      let delay = pollInterval;
      try {
        const result = await pollChat(
          sessionToken,
          pollCursor(messagesRef.current),
          current.signal,
        );
        if (stopped || current.signal.aborted) return;
        first = false;
        failures = 0;
        setPollError(null);
        dispatch({ type: firstLoad ? "history" : "polled", result });
        setHistoryLoaded(true);
        // A message reported as failed reached the server after all: no error, no text to resend.
        const failure = sendFailureRef.current;
        if (failure && result.messages.some((message) => isServerCopy(message, failure))) {
          sendFailureRef.current = null;
          setSendFailure(null);
          onDeliveredLateRef.current?.(failure.body);
        }
      } catch (error) {
        if (stopped || current.signal.aborted) return;
        if (isNotFound(error)) {
          stopped = true;
          endSession("expired");
          return;
        }
        if (isRateLimited(error)) {
          delay = Math.max(pollInterval, retryAfterMs(error, 10));
        } else {
          failures += 1;
          delay = Math.min(MAX_POLL_BACKOFF_MS, pollInterval * 2 ** failures);
          // One blip is not worth a banner once messages are on screen.
          if (firstLoad || failures >= 2) setPollError(error);
        }
      } finally {
        if (controller === current) controller = null;
      }
      schedule(delay);
    }

    function onVisibilityChange() {
      if (isHidden()) {
        clearTimeout(timer);
        controller?.abort();
        controller = null;
      } else {
        void run();
      }
    }

    pollNowRef.current = () => {
      clearTimeout(timer);
      void run();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      controller = null;
      pollNowRef.current = () => {};
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [token, pollInterval, endSession]);

  // ── send cooldown after a 429 ──────────────────────────────────────────
  useEffect(() => {
    if (cooldownUntil === null) return;
    const timer = setTimeout(() => setCooldownUntil(null), Math.max(0, cooldownUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  // ── start ──────────────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: () => startChat(slug, lang),
    meta: { silentError: true },
  });
  const startAsync = startMutation.mutateAsync;

  const start = useCallback(async () => {
    try {
      const result = await startAsync();
      const saved = store.write(slug, result.session_token);
      setPersistent(saved && store.persistent);
      setEndedBecause(null);
      setPollError(null);
      setSendFailure(null);
      dispatch({ type: "started", messages: result.messages });
      setHistoryLoaded(true);
      tokenRef.current = result.session_token;
      setToken(result.session_token);
      return true;
    } catch {
      return false;
    }
  }, [slug, store, startAsync]);

  // ── send ───────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (variables: { token: string; text: string }) =>
      sendChatMessage(variables.token, variables.text),
    meta: { silentError: true },
  });
  const sendAsync = sendMutation.mutateAsync;

  /**
   * After a send with an unknown outcome: polls until the message's server copy
   * shows up (true) or the window passes (false). Hidden time does not count,
   * because polling stops while the page is hidden.
   */
  const awaitServerCopy = useCallback(
    async (delivered: () => boolean, isCurrent: () => boolean) => {
      const step = Math.max(1, Math.min(500, reconcileWindow / 10));
      const nudgeEvery = Math.max(step, reconcileWindow / 3);
      let waited = 0;
      let sinceNudge = 0;
      pollNowRef.current();
      while (waited < reconcileWindow) {
        await sleep(step);
        if (!aliveRef.current || !isCurrent()) return false;
        if (delivered()) return true;
        if (isHidden()) continue;
        waited += step;
        sinceNudge += step;
        // Also past a poll back-off; at most a few extra polls per window.
        if (sinceNudge >= nudgeEvery) {
          sinceNudge = 0;
          pollNowRef.current();
        }
      }
      return delivered();
    },
    [reconcileWindow],
  );

  const send = useCallback(
    async (text: string) => {
      const sessionToken = tokenRef.current;
      const body = text.trim();
      if (!sessionToken || !body) return false;
      const id = localId();
      const sent = {
        body,
        known: new Set(
          messagesRef.current.filter((message) => !message.local).map((message) => message.id),
        ),
      };
      dispatch({
        type: "sending",
        id,
        body,
        createdAt: new Date().toISOString(),
        nowMicros: Date.now() * 1000,
      });
      setSendFailure(null);
      const isCurrent = () => tokenRef.current === sessionToken;
      // A poll swaps the local copy for the server copy (mergeMessages): then it was saved.
      const delivered = () => {
        const messages = messagesRef.current;
        return (
          !messages.some((message) => message.id === id) &&
          messages.some((message) => isServerCopy(message, sent))
        );
      };
      try {
        const result = await sendAsync({ token: sessionToken, text: body });
        if (!isCurrent()) return true;
        dispatch({ type: "sent", id, result });
        return true;
      } catch (error) {
        if (!isCurrent()) return false;
        if (isNotFound(error)) {
          dispatch({ type: "sendFailed", id });
          endSession("expired");
          return false;
        }
        if (delivered()) return true;
        if (sendOutcomeUnknown(error)) {
          // Keep the message as "sending", without Resend, until the server says whether it has it.
          setUnconfirmed((ids) => [...ids, id]);
          const confirmed = await awaitServerCopy(delivered, isCurrent);
          setUnconfirmed((ids) => ids.filter((other) => other !== id));
          if (!isCurrent()) return confirmed;
          if (confirmed) return true;
        }
        dispatch({ type: "sendFailed", id });
        if (isRateLimited(error)) {
          setCooldownUntil(Date.now() + Math.min(retryAfterMs(error, 30), MAX_SEND_COOLDOWN_MS));
        }
        setSendFailure({ error, uncertain: sendOutcomeUnknown(error), ...sent });
        return false;
      }
    },
    [awaitServerCopy, endSession, sendAsync],
  );

  // ── delete / leave ─────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (sessionToken: string) => deleteChat(sessionToken),
    meta: { silentError: true },
  });
  const deleteAsync = deleteMutation.mutateAsync;

  const deleteConversation = useCallback(async (): Promise<unknown> => {
    const sessionToken = tokenRef.current;
    if (!sessionToken) return null;
    try {
      await deleteAsync(sessionToken);
    } catch (error) {
      // Already gone on the server: the visitor's goal is met.
      if (!isNotFound(error)) return error;
    }
    endSession("deleted");
    return null;
  }, [deleteAsync, endSession]);

  const leave = useCallback(() => endSession("left"), [endSession]);
  const retryPoll = useCallback(() => pollNowRef.current(), []);

  const phase: ChatPhase = !token ? "consent" : historyLoaded ? "ready" : "loading";
  // A failed message that a later poll shows on the server was delivered after all.
  const sendError =
    sendFailure && !state.messages.some((message) => isServerCopy(message, sendFailure))
      ? sendFailure.error
      : null;
  const sendUnconfirmed = unconfirmed.some((id) =>
    state.messages.some((message) => message.id === id),
  );
  const sendUncertain = sendError !== null && sendFailure?.uncertain === true;

  return {
    phase,
    state,
    persistent,
    endedBecause,
    start,
    starting: startMutation.isPending,
    startError: startMutation.error,
    send,
    sending: sendMutation.isPending,
    sendError,
    sendUnconfirmed,
    sendUncertain,
    cooldownUntil,
    pollError,
    retryPoll,
    deleteConversation,
    deleting: deleteMutation.isPending,
    leave,
  };
}
