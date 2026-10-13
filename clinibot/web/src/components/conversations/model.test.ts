import { describe, expect, it } from "vitest";
import {
  escapeLike,
  maskWaId,
  needsReply,
  parseConversationSearch,
  parseHandoffReason,
  serviceWindow,
} from "./model";

describe("needsReply", () => {
  it("is true when the customer spoke last on an open conversation", () => {
    expect(needsReply({ status: "open", last_message_direction: "inbound" })).toBe(true);
  });

  it("is true when the conversation waits for staff, whoever spoke last", () => {
    expect(needsReply({ status: "awaiting_human", last_message_direction: "outbound" })).toBe(true);
    expect(needsReply({ status: "awaiting_human", last_message_direction: null })).toBe(true);
  });

  it("is false when the clinic answered last", () => {
    expect(needsReply({ status: "open", last_message_direction: "outbound" })).toBe(false);
    expect(needsReply({ status: "open", last_message_direction: null })).toBe(false);
  });

  it("is never true for a closed conversation", () => {
    expect(needsReply({ status: "closed", last_message_direction: "inbound" })).toBe(false);
  });
});

describe("maskWaId", () => {
  it("hides the middle of a Saudi WhatsApp number", () => {
    expect(maskWaId("966551234567")).toBe("+9665•••••567");
  });

  it("works for other lengths", () => {
    expect(maskWaId("447700900123")).toBe("+4477•••••123");
    expect(maskWaId("12025550123")).toBe("+1202••••123");
    expect(maskWaId("1234567")).toBe("+12•••67");
    expect(maskWaId("")).toBe("");
  });

  it("never reveals more than seven digits", () => {
    const masked = maskWaId("966551234567");
    expect(masked.replace(/\D/g, "")).toHaveLength(7);
  });
});

describe("serviceWindow", () => {
  const now = new Date("2026-10-12T12:00:00Z");

  it("is open within 24 hours of the last customer message", () => {
    const window = serviceWindow("2026-10-12T02:00:00Z", now);
    expect(window.open).toBe(true);
    expect(window.closesAt?.toISOString()).toBe("2026-10-13T02:00:00.000Z");
    expect(window.msLeft).toBe(14 * 3600 * 1000);
  });

  it("is closed after 24 hours or when the customer never wrote", () => {
    expect(serviceWindow("2026-10-11T11:59:59Z", now).open).toBe(false);
    expect(serviceWindow("2026-10-11T11:59:59Z", now).msLeft).toBe(0);
    expect(serviceWindow(null, now)).toEqual({ open: false, closesAt: null, msLeft: 0 });
  });
});

describe("parseHandoffReason", () => {
  it("splits the code and the assistant's summary", () => {
    expect(parseHandoffReason("medical_question: يسأل عن دواء")).toEqual({
      code: "medical_question",
      summary: "يسأل عن دواء",
    });
  });

  it("reads bare codes", () => {
    expect(parseHandoffReason("possible_emergency")).toEqual({
      code: "possible_emergency",
      summary: null,
    });
  });

  it("keeps unknown text as written", () => {
    expect(parseHandoffReason("Called twice")).toEqual({ code: null, summary: "Called twice" });
    expect(parseHandoffReason("  ")).toBeNull();
    expect(parseHandoffReason(null)).toBeNull();
  });
});

describe("search", () => {
  it("searches numbers by digits, in any script", () => {
    expect(parseConversationSearch("٠٥٥ ١٢٣")).toEqual({ kind: "number", value: "55123" });
    expect(parseConversationSearch("+966 55")).toEqual({ kind: "number", value: "96655" });
  });

  it("searches names otherwise", () => {
    expect(parseConversationSearch("  سارة ")).toEqual({ kind: "name", value: "سارة" });
    expect(parseConversationSearch("")).toBeNull();
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
