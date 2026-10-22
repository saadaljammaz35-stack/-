import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import type { TokenStore } from "./sessionStore";
import type { TurnResult } from "./types";
import { sendOutcomeUnknown, useChatSession } from "./useChatSession";

// Plain functions, not vi.fn(): a returned rejected promise must not count as a test failure.
const api = vi.hoisted(() => ({
  send: (_token: string, _text: string): Promise<unknown> => new Promise(() => {}),
  poll: (): Promise<unknown> => new Promise(() => {}),
  polls: 0,
}));

vi.mock("./chatApi", () => ({
  startChat: () => new Promise(() => {}),
  deleteChat: () => Promise.resolve(),
  sendChatMessage: (token: string, text: string) => api.send(token, text),
  pollChat: () => {
    api.polls += 1;
    return api.poll();
  },
}));

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

const welcome = {
  id: "w1",
  direction: "outbound" as const,
  sender: "system" as const,
  body: "Welcome!",
  created_at: "2026-10-12T10:00:00+00:00",
};

function turn(messages: TurnResult["messages"] = []): TurnResult {
  return { messages, status: "open", ai_paused: false };
}

function customer(id: string, body: string) {
  return {
    id,
    direction: "inbound" as const,
    sender: "customer" as const,
    body,
    created_at: "2026-10-12T10:00:05+00:00",
  };
}

const store: TokenStore = {
  read: () => TOKEN,
  write: () => true,
  clear: () => {},
  persistent: true,
};

function renderSession(onDeliveredLate?: (body: string) => void) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useChatSession({
        slug: "smile",
        lang: "en",
        store,
        pollInterval: 20,
        reconcileWindow: 150,
        onDeliveredLate,
      }),
    { wrapper },
  );
}

async function ready(result: { current: ReturnType<typeof useChatSession> }) {
  await waitFor(() => expect(result.current.phase).toBe("ready"));
}

beforeEach(() => {
  api.polls = 0;
  api.poll = () => Promise.resolve(turn([welcome]));
  api.send = () => new Promise(() => {});
});

describe("sendOutcomeUnknown", () => {
  it("is true only when the request may have reached the server", () => {
    const error = (status: number, code: string) => new ApiError({ status, code, message: "" });
    expect(sendOutcomeUnknown(error(0, "timeout"))).toBe(true);
    expect(sendOutcomeUnknown(error(0, "network_error"))).toBe(true);
    expect(sendOutcomeUnknown(error(504, "upstream_error"))).toBe(true);
    expect(sendOutcomeUnknown(error(546, "internal_error"))).toBe(true);
    // The handler stores the message before the assistant runs, so a 500 may come after it.
    expect(sendOutcomeUnknown(error(500, "internal_error"))).toBe(true);
    expect(sendOutcomeUnknown(error(0, "aborted"))).toBe(true);
    expect(sendOutcomeUnknown(error(0, "invalid_response"))).toBe(true);
    expect(sendOutcomeUnknown(new Error("unexpected"))).toBe(true);
    expect(sendOutcomeUnknown(error(400, "invalid_request"))).toBe(false);
    expect(sendOutcomeUnknown(error(404, "not_found"))).toBe(false);
    expect(sendOutcomeUnknown(error(429, "rate_limited"))).toBe(false);
    // The rate limiter answers before the message is stored.
    expect(sendOutcomeUnknown(error(503, "rate_limit_unavailable"))).toBe(false);
  });
});

describe("useChatSession send", () => {
  it("keeps an unanswered message pending, then gives it back when the server never shows it", async () => {
    const timeout = new ApiError({ status: 0, code: "timeout", message: "Request timed out" });
    api.send = () => Promise.reject(timeout);
    const { result } = renderSession();
    await ready(result);

    let sent: Promise<boolean> = Promise.resolve(true);
    act(() => {
      sent = result.current.send("Are you open?");
    });
    await waitFor(() => expect(result.current.sendUnconfirmed).toBe(true));
    expect(result.current.sendError).toBeNull();
    expect(result.current.state.messages.find((message) => message.local)?.pending).toBe(true);

    let ok = true;
    await act(async () => {
      ok = await sent;
    });
    expect(ok).toBe(false);
    expect(result.current.sendUnconfirmed).toBe(false);
    expect(result.current.sendError).toBe(timeout);
    // Not refused: the page says "couldn't confirm", not "not sent".
    expect(result.current.sendUncertain).toBe(true);
    expect(result.current.state.messages.some((message) => message.local)).toBe(false);
  });

  it("counts an unanswered message as sent once a poll brings back its server copy", async () => {
    api.send = () =>
      Promise.reject(new ApiError({ status: 504, code: "upstream_error", message: "" }));
    const { result } = renderSession();
    await ready(result);
    const before = api.polls;
    api.poll = () => Promise.resolve(turn([customer("c1", "Are you open?")]));

    let ok = false;
    await act(async () => {
      ok = await result.current.send("Are you open?");
    });
    expect(ok).toBe(true);
    expect(api.polls).toBeGreaterThan(before);
    expect(result.current.sendError).toBeNull();
    expect(result.current.sendUnconfirmed).toBe(false);
    expect(result.current.state.messages.map((message) => message.id)).toEqual(["w1", "c1"]);
  });

  it("clears a send error when a later poll shows the message reached the server", async () => {
    api.send = () =>
      Promise.reject(new ApiError({ status: 500, code: "internal_error", message: "" }));
    const delivered: string[] = [];
    const { result } = renderSession((body) => delivered.push(body));
    await ready(result);

    let ok = true;
    await act(async () => {
      ok = await result.current.send("Are you open?");
    });
    expect(ok).toBe(false);
    expect(result.current.sendError).not.toBeNull();
    expect(result.current.sendUncertain).toBe(true);

    api.poll = () => Promise.resolve(turn([customer("c1", "Are you open?")]));
    act(() => result.current.retryPoll());
    await waitFor(() => expect(result.current.sendError).toBeNull());
    expect(result.current.sendUncertain).toBe(false);
    expect(delivered).toEqual(["Are you open?"]);
  });

  it("reports a refused message as not sent, without waiting for the server", async () => {
    const refused = new ApiError({ status: 400, code: "invalid_request", message: "" });
    api.send = () => Promise.reject(refused);
    const { result } = renderSession();
    await ready(result);

    let ok = true;
    await act(async () => {
      ok = await result.current.send("Are you open?");
    });
    expect(ok).toBe(false);
    expect(result.current.sendError).toBe(refused);
    expect(result.current.sendUncertain).toBe(false);
    expect(result.current.sendUnconfirmed).toBe(false);
  });

  it("pauses sending for at most a minute after a 429, whatever window the server names", async () => {
    api.send = () =>
      Promise.reject(
        new ApiError({
          status: 429,
          code: "rate_limited",
          message: "",
          details: { retry_after_seconds: 600 },
        }),
      );
    const { result } = renderSession();
    await ready(result);
    await act(async () => {
      await result.current.send("hello");
    });
    const until = result.current.cooldownUntil;
    expect(until).not.toBeNull();
    // A minute, rounded up to the next whole minute so the time shown is when sending resumes.
    expect((until ?? 0) % 60_000).toBe(0);
    expect((until ?? 0) - Date.now()).toBeLessThanOrEqual(120_000);
    expect((until ?? 0) - Date.now()).toBeGreaterThan(50_000);
  });
});
