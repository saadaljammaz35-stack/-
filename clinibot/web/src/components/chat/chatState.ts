import { localAnchor, mergeMessages, newArrivals, sortTimeline, toTimeline } from "./model";
import type { ChatMessage, ConversationStatus, TimelineMessage, TurnResult } from "./types";

/** What the open chat shows. Pure: every change goes through chatReducer. */
export interface ChatState {
  messages: readonly TimelineMessage[];
  status: ConversationStatus;
  aiPaused: boolean;
  /** Clinic-side messages that arrived in the latest update (read out by the live region). */
  arrivals: readonly ChatMessage[];
  /** Bumped whenever `arrivals` changes, so the same text can be announced again. */
  arrivalSeq: number;
}

export const initialChatState: ChatState = {
  messages: [],
  status: "open",
  aiPaused: false,
  arrivals: [],
  arrivalSeq: 0,
};

export type ChatAction =
  /** Back to an empty chat (consent screen, deleted, expired). */
  | { type: "reset" }
  /** A new conversation began; `messages` is the welcome message. */
  | { type: "started"; messages: readonly ChatMessage[] }
  /** First poll of a conversation continued from storage: history, not news. */
  | { type: "history"; result: TurnResult }
  | { type: "polled"; result: TurnResult }
  /** The visitor pressed send: show their message right away. */
  | { type: "sending"; id: string; body: string; createdAt: string; nowMicros: number }
  | { type: "sent"; id: string; result: TurnResult }
  | { type: "sendFailed"; id: string };

function withArrivals(state: ChatState, arrivals: readonly ChatMessage[]): ChatState {
  if (arrivals.length === 0) return state;
  return { ...state, arrivals, arrivalSeq: state.arrivalSeq + 1 };
}

function applyTurn(state: ChatState, result: TurnResult, announce: boolean): ChatState {
  const arrivals = announce ? newArrivals(state.messages, result.messages) : [];
  const messages = mergeMessages(state.messages, result.messages);
  const next =
    messages === state.messages &&
    state.status === result.status &&
    state.aiPaused === result.ai_paused
      ? state
      : { ...state, messages, status: result.status, aiPaused: result.ai_paused };
  return withArrivals(next, arrivals);
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return { ...initialChatState, arrivalSeq: state.arrivalSeq };

    case "started": {
      const messages = sortTimeline(action.messages.map(toTimeline));
      return withArrivals(
        { ...initialChatState, arrivalSeq: state.arrivalSeq, messages },
        action.messages.filter((message) => message.sender !== "customer"),
      );
    }

    case "history":
      return applyTurn(state, action.result, false);

    case "polled":
      return applyTurn(state, action.result, true);

    case "sending": {
      const message: TimelineMessage = {
        id: action.id,
        direction: "inbound",
        sender: "customer",
        body: action.body,
        created_at: action.createdAt,
        at: localAnchor(state.messages, action.nowMicros),
        local: true,
        pending: true,
      };
      return { ...state, messages: [...state.messages, message] };
    }

    case "sent": {
      const messages = state.messages.map((message) =>
        message.id === action.id && message.pending ? { ...message, pending: false } : message,
      );
      return applyTurn({ ...state, messages }, action.result, true);
    }

    case "sendFailed": {
      if (!state.messages.some((message) => message.id === action.id)) return state;
      return { ...state, messages: state.messages.filter((message) => message.id !== action.id) };
    }
  }
}
