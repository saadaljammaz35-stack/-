import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState, type ChatAction, type ChatState } from "./chatState";
import type { ChatMessage } from "./types";

function msg(
  id: string,
  created_at: string,
  sender: ChatMessage["sender"] = "assistant",
  body = `body ${id}`,
): ChatMessage {
  return {
    id,
    created_at,
    sender,
    body,
    direction: sender === "customer" ? "inbound" : "outbound",
  };
}

function run(actions: ChatAction[], state: ChatState = initialChatState): ChatState {
  return actions.reduce(chatReducer, state);
}

const welcome = msg("w", "2026-10-12T10:00:00.000100+00:00", "system", "مرحباً");
const ids = (state: ChatState) => state.messages.map((message) => message.id);

describe("chatReducer", () => {
  it("starts with the welcome message and announces it", () => {
    const state = run([{ type: "started", messages: [welcome] }]);
    expect(ids(state)).toEqual(["w"]);
    expect(state.arrivals).toEqual([welcome]);
    expect(state.arrivalSeq).toBe(1);
  });

  it("shows the visitor's message at once, then the replies after it", () => {
    const sending = run([
      { type: "started", messages: [welcome] },
      { type: "sending", id: "local-1", body: "كم السعر؟", createdAt: "x", nowMicros: 0 },
    ]);
    expect(ids(sending)).toEqual(["w", "local-1"]);
    expect(sending.messages[1]).toMatchObject({ pending: true, local: true, sender: "customer" });

    const reply = msg("r1", "2026-10-12T10:00:05+00:00", "assistant", "200 ريال");
    const sent = chatReducer(sending, {
      type: "sent",
      id: "local-1",
      result: { messages: [reply], status: "open", ai_paused: false },
    });
    expect(ids(sent)).toEqual(["w", "local-1", "r1"]);
    expect(sent.messages[1]?.pending).toBe(false);
    expect(sent.arrivals).toEqual([reply]);
  });

  it("removes the local message when sending fails", () => {
    const state = run([
      { type: "started", messages: [welcome] },
      { type: "sending", id: "local-1", body: "hi", createdAt: "x", nowMicros: 0 },
      { type: "sendFailed", id: "local-1" },
    ]);
    expect(ids(state)).toEqual(["w"]);
    expect(chatReducer(state, { type: "sendFailed", id: "nope" })).toBe(state);
  });

  it("does not duplicate a reply that a poll already delivered", () => {
    const reply = msg("r1", "2026-10-12T10:00:05+00:00");
    const state = run([
      { type: "started", messages: [welcome] },
      { type: "sending", id: "local-1", body: "hi", createdAt: "x", nowMicros: 0 },
      {
        type: "polled",
        result: {
          messages: [msg("in1", "2026-10-12T10:00:04+00:00", "customer", "hi"), reply],
          status: "open",
          ai_paused: false,
        },
      },
      {
        type: "sent",
        id: "local-1",
        result: { messages: [reply], status: "open", ai_paused: false },
      },
    ]);
    expect(ids(state)).toEqual(["w", "in1", "r1"]);
  });

  it("loads history without announcing it, then announces what is new", () => {
    const history = run([
      {
        type: "history",
        result: {
          messages: [welcome, msg("r1", "2026-10-12T10:00:05Z")],
          status: "awaiting_human",
          ai_paused: true,
        },
      },
    ]);
    expect(ids(history)).toEqual(["w", "r1"]);
    expect(history.arrivals).toEqual([]);
    expect(history.status).toBe("awaiting_human");
    expect(history.aiPaused).toBe(true);

    const staff = msg("s1", "2026-10-12T10:01:00Z", "staff", "معك سارة من الاستقبال");
    const polled = chatReducer(history, {
      type: "polled",
      result: {
        messages: [msg("r1", "2026-10-12T10:00:05Z"), staff],
        status: "open",
        ai_paused: true,
      },
    });
    expect(ids(polled)).toEqual(["w", "r1", "s1"]);
    expect(polled.arrivals).toEqual([staff]);
    expect(polled.status).toBe("open");
  });

  it("returns the same state for a poll with nothing new", () => {
    const state = run([{ type: "started", messages: [welcome] }]);
    const polled = chatReducer(state, {
      type: "polled",
      result: { messages: [welcome], status: "open", ai_paused: false },
    });
    expect(polled).toBe(state);
  });

  it("resets to an empty chat", () => {
    const state = run([{ type: "started", messages: [welcome] }, { type: "reset" }]);
    expect(state.messages).toEqual([]);
    expect(state.arrivals).toEqual([]);
  });
});
