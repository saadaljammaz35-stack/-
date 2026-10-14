import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Lang } from "@/i18n";
import { isApiError } from "@/lib/api";
import { deleteChat, pollChat, sendChatMessage, startChat } from "./chatApi";
import { chatReducer, initialChatState, type ChatState } from "./chatState";
import { MAX_POLL_BACKOFF_MS, POLL_INTERVAL_MS, pollCursor } from "./model";
import { sharedTokenStore, type TokenStore } from "./sessionStore";

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
}: Options): ChatSession {
  const [token, setToken] = useState<string | null>(() => store.read(slug));
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [persistent, setPersistent] = useState(() => store.persistent);
  const [endedBecause, setEndedBecause] = useState<SessionEnd | null>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  // Read by the poll loop and async handlers, which outlive a render.
  const messagesRef = useRef(state.messages);
  const tokenRef = useRef(token);
  const pollNowRef = useRef<() => void>(() => {});
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const endSession = useCallback(
    (reason: SessionEnd) => {
      store.clear(slug);
      tokenRef.current = null;
      setToken(null);
      setHistoryLoaded(false);
      dispatch({ type: "reset" });
      setPollError(null);
      setSendError(null);
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
      setSendError(null);
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

  const send = useCallback(
    async (text: string) => {
      const sessionToken = tokenRef.current;
      const body = text.trim();
      if (!sessionToken || !body) return false;
      const id = localId();
      dispatch({
        type: "sending",
        id,
        body,
        createdAt: new Date().toISOString(),
        nowMicros: Date.now() * 1000,
      });
      setSendError(null);
      try {
        const result = await sendAsync({ token: sessionToken, text: body });
        if (tokenRef.current !== sessionToken) return true;
        dispatch({ type: "sent", id, result });
        return true;
      } catch (error) {
        if (tokenRef.current !== sessionToken) return false;
        dispatch({ type: "sendFailed", id });
        if (isNotFound(error)) {
          endSession("expired");
          return false;
        }
        if (isRateLimited(error)) setCooldownUntil(Date.now() + retryAfterMs(error, 30));
        setSendError(error);
        return false;
      }
    },
    [endSession, sendAsync],
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
    cooldownUntil,
    pollError,
    retryPoll,
    deleteConversation,
    deleting: deleteMutation.isPending,
    leave,
  };
}
