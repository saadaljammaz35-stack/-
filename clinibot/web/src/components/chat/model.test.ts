import { describe, expect, it } from "vitest";
import {
  checkDraft,
  conversationNotice,
  groupMessages,
  isWelcomeMessage,
  linkify,
  localAnchor,
  mergeMessages,
  newArrivals,
  parseTimestamp,
  pollCursor,
  restoreDraft,
  sideOf,
  telHref,
  toTimeline,
} from "./model";
import type { ChatMessage, TimelineMessage } from "./types";

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

function local(id: string, body: string, at: number, pending = false): TimelineMessage {
  return {
    id,
    body,
    at,
    pending,
    local: true,
    sender: "customer",
    direction: "inbound",
    created_at: "2026-10-12T10:00:00.000Z",
  };
}

const ids = (messages: readonly TimelineMessage[]) => messages.map((message) => message.id);

describe("parseTimestamp", () => {
  it("keeps microseconds from Postgres timestamps", () => {
    const a = parseTimestamp("2026-10-12T10:00:00.123456+00:00");
    const b = parseTimestamp("2026-10-12T10:00:00.123457+00:00");
    expect(a).not.toBeNull();
    expect(b! - a!).toBe(1);
    expect(a).toBe(Date.UTC(2026, 9, 12, 10, 0, 0, 123) * 1000 + 456);
  });

  it("applies offsets and accepts Z, no fraction, and a space separator", () => {
    const utc = Date.UTC(2026, 9, 12, 7, 0, 0) * 1000;
    expect(parseTimestamp("2026-10-12T10:00:00+03:00")).toBe(utc);
    expect(parseTimestamp("2026-10-12T07:00:00Z")).toBe(utc);
    expect(parseTimestamp("2026-10-12 07:00:00+00")).toBe(utc);
    expect(parseTimestamp("2026-10-12T04:30:00-02:30")).toBe(utc);
  });

  it("returns null for garbage", () => {
    expect(parseTimestamp("yesterday")).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });
});

describe("mergeMessages", () => {
  const a = msg("a", "2026-10-12T10:00:00.000001+00:00", "system");
  const b = msg("b", "2026-10-12T10:00:05+00:00");
  const c = msg("c", "2026-10-12T10:00:09+00:00");

  it("merges by id without duplicates and sorts oldest first", () => {
    const first = mergeMessages([], [c, a]);
    expect(ids(first)).toEqual(["a", "c"]);
    const second = mergeMessages(first, [c, b, a]);
    expect(ids(second)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array when nothing new arrives", () => {
    const timeline = mergeMessages([], [a, b]);
    expect(mergeMessages(timeline, [])).toBe(timeline);
    expect(mergeMessages(timeline, [b, a])).toBe(timeline);
  });

  it("replaces the visitor's pending local copy with the server copy", () => {
    const timeline = mergeMessages([], [a]);
    const withLocal = [...timeline, local("local-1", "كم السعر؟", toTimeline(a).at + 1, true)];
    const serverCopy = msg("s1", "2026-10-12T10:00:01+00:00", "customer", "كم السعر؟");
    const merged = mergeMessages(withLocal, [serverCopy]);
    expect(ids(merged)).toEqual(["a", "s1"]);
  });

  it("replaces a sent local copy when a later poll brings the server copy", () => {
    const anchor = toTimeline(a).at + 1;
    const withLocal = [toTimeline(a), local("local-1", " hello ", anchor)];
    const merged = mergeMessages(withLocal, [
      msg("s1", "2026-10-12T10:00:01+00:00", "customer", "hello"),
      b,
    ]);
    expect(ids(merged)).toEqual(["a", "s1", "b"]);
  });

  it("does not touch local copies with different text", () => {
    const withLocal = [toTimeline(a), local("local-1", "first", toTimeline(a).at + 1)];
    const merged = mergeMessages(withLocal, [
      msg("s2", "2026-10-12T10:00:02+00:00", "customer", "second"),
    ]);
    expect(ids(merged)).toEqual(["a", "local-1", "s2"]);
  });

  it("matches only one local copy per server copy when the same text was sent twice", () => {
    const base = toTimeline(a).at;
    const withLocal = [
      toTimeline(a),
      local("local-1", "yes", base + 1),
      local("local-2", "yes", base + 2, true),
    ];
    const merged = mergeMessages(withLocal, [
      msg("s9", "2026-10-12T10:00:03+00:00", "customer", "yes"),
    ]);
    // The pending one is the copy being confirmed; the older one stays.
    expect(ids(merged)).toEqual(["a", "local-1", "s9"]);
  });

  it("keeps a local message between earlier messages and the replies", () => {
    const timeline = mergeMessages([], [a]);
    const anchor = localAnchor(timeline, 0);
    const withLocal = [...timeline, local("local-1", "q", anchor)];
    const merged = mergeMessages(withLocal, [b]);
    expect(ids(merged)).toEqual(["a", "local-1", "b"]);
  });
});

describe("pollCursor", () => {
  it("is undefined before any server message", () => {
    expect(pollCursor([])).toBeUndefined();
    expect(pollCursor([local("local-1", "x", 10)])).toBeUndefined();
  });

  it("returns the newest server timestamp exactly as received, ignoring local copies", () => {
    const timeline = mergeMessages(
      [],
      [
        msg("a", "2026-10-12T10:00:00.5+00:00"),
        msg("b", "2026-10-12T10:00:09.123456+00:00"),
        msg("c", "2026-10-12T13:00:05+03:00"), // 10:00:05 UTC: older than b
      ],
    );
    const withLocal = [...timeline, local("local-1", "x", Number.MAX_SAFE_INTEGER)];
    expect(pollCursor(withLocal)).toBe("2026-10-12T10:00:09.123456+00:00");
  });
});

describe("localAnchor", () => {
  it("places a new local message after everything shown", () => {
    const timeline = mergeMessages([], [msg("a", "2026-10-12T10:00:00Z")]);
    expect(localAnchor(timeline, 5)).toBe(timeline[0]!.at + 1);
    expect(localAnchor([], 5)).toBe(5);
  });
});

describe("newArrivals", () => {
  it("lists only unseen clinic-side messages, once", () => {
    const existing = mergeMessages([], [msg("a", "2026-10-12T10:00:00Z")]);
    const arrivals = newArrivals(existing, [
      msg("a", "2026-10-12T10:00:00Z"),
      msg("b", "2026-10-12T10:00:01Z", "customer"),
      msg("c", "2026-10-12T10:00:02Z", "staff"),
      msg("c", "2026-10-12T10:00:02Z", "staff"),
    ]);
    expect(arrivals.map((message) => message.id)).toEqual(["c"]);
  });
});

describe("groupMessages", () => {
  const timeline = mergeMessages(
    [],
    [
      msg("w", "2026-10-12T10:00:00Z", "system"),
      msg("q1", "2026-10-12T10:01:00Z", "customer"),
      msg("q2", "2026-10-12T10:01:30Z", "customer"),
      msg("r1", "2026-10-12T10:01:40Z", "assistant"),
      msg("r2", "2026-10-12T10:01:41Z", "assistant"),
      msg("s1", "2026-10-12T10:02:00Z", "staff"),
      msg("n1", "2026-10-12T10:03:00Z", "system"),
      msg("n2", "2026-10-12T10:03:01Z", "system"),
      msg("q3", "2026-10-12T10:30:00Z", "customer"),
      msg("q4", "2026-10-12T10:30:10Z", "customer"),
    ],
  );

  it("groups consecutive messages by sender with the right side", () => {
    const groups = groupMessages(timeline);
    expect(groups.map((group) => [group.sender, group.side, ids(group.messages)])).toEqual([
      ["system", "center", ["w"]],
      ["customer", "end", ["q1", "q2"]],
      ["assistant", "start", ["r1", "r2"]],
      ["staff", "start", ["s1"]],
      ["system", "center", ["n1"]],
      ["system", "center", ["n2"]],
      ["customer", "end", ["q3", "q4"]],
    ]);
  });

  it("sorts unsorted input before grouping", () => {
    const groups = groupMessages([...timeline].reverse());
    expect(groups.map((group) => group.key)).toEqual(["w", "q1", "r1", "s1", "n1", "n2", "q3"]);
  });

  it("starts a new group after a long pause from the same sender", () => {
    const pause = mergeMessages(
      [],
      [
        msg("p1", "2026-10-12T10:00:00Z", "customer"),
        msg("p2", "2026-10-12T10:09:00Z", "customer"),
        msg("p3", "2026-10-12T10:25:00Z", "customer"),
      ],
    );
    expect(groupMessages(pause).map((group) => ids(group.messages))).toEqual([
      ["p1", "p2"],
      ["p3"],
    ]);
    expect(groupMessages(pause, 5).map((group) => ids(group.messages))).toEqual([
      ["p1"],
      ["p2"],
      ["p3"],
    ]);
  });

  it("puts the visitor at the end, the clinic at the start, notices in the centre", () => {
    expect(sideOf("customer")).toBe("end");
    expect(sideOf("assistant")).toBe("start");
    expect(sideOf("staff")).toBe("start");
    expect(sideOf("system")).toBe("center");
  });
});

describe("isWelcomeMessage", () => {
  const profile = { welcome_message: { ar: "أهلاً بك", en: "Welcome!" } };
  it("recognises the stored greeting in either language", () => {
    expect(isWelcomeMessage({ sender: "system", body: " أهلاً بك " }, profile)).toBe(true);
    expect(isWelcomeMessage({ sender: "system", body: "Welcome!" }, profile)).toBe(true);
    expect(isWelcomeMessage({ sender: "assistant", body: "Welcome!" }, profile)).toBe(false);
    expect(isWelcomeMessage({ sender: "system", body: "Deleted." }, profile)).toBe(false);
    expect(
      isWelcomeMessage({ sender: "system", body: "" }, { welcome_message: { ar: "", en: "" } }),
    ).toBe(false);
  });
});

describe("conversationNotice", () => {
  it("prefers the staff follow-up notice", () => {
    expect(conversationNotice("awaiting_human", false, true)).toBe("awaiting_human");
    expect(conversationNotice("open", true, false)).toBe("awaiting_human");
    expect(conversationNotice("open", false, false)).toBe("assistant_unavailable");
    expect(conversationNotice("closed", false, true)).toBe("closed");
    expect(conversationNotice("open", false, true)).toBeNull();
  });
});

describe("checkDraft / restoreDraft", () => {
  it("counts trimmed characters and enforces 1–1000", () => {
    expect(checkDraft("   ")).toEqual({ length: 0, ok: false, problem: "empty" });
    expect(checkDraft(" hi ")).toEqual({ length: 2, ok: true, problem: null });
    expect(checkDraft("x".repeat(1000)).ok).toBe(true);
    expect(checkDraft(`${"x".repeat(1000)}  `).ok).toBe(true);
    expect(checkDraft("x".repeat(1001))).toMatchObject({ ok: false, problem: "too_long" });
  });

  it("puts a failed message back without losing newer typing", () => {
    expect(restoreDraft("hello", "")).toBe("hello");
    expect(restoreDraft("hello", "  ")).toBe("hello");
    expect(restoreDraft("hello", "and more")).toBe("hello\nand more");
    expect(restoreDraft("hello", "hello again")).toBe("hello again");
  });
});

describe("linkify", () => {
  it("turns only http(s) URLs into links and drops trailing punctuation", () => {
    expect(linkify("الموقع: https://maps.example.com/x?q=1، شكراً")).toEqual([
      { kind: "text", text: "الموقع: " },
      {
        kind: "link",
        text: "https://maps.example.com/x?q=1",
        href: "https://maps.example.com/x?q=1",
      },
      { kind: "text", text: "، شكراً" },
    ]);
    expect(linkify("see http://a.example.")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", text: "http://a.example", href: "http://a.example" },
      { kind: "text", text: "." },
    ]);
    expect(linkify("javascript:alert(1) and ftp://x.y")).toEqual([
      { kind: "text", text: "javascript:alert(1) and ftp://x.y" },
    ]);
    expect(linkify("")).toEqual([]);
  });
});

describe("telHref", () => {
  it("keeps digits and a leading plus", () => {
    expect(telHref("+966 55 123 4567")).toBe("tel:+966551234567");
    expect(telHref("997")).toBe("tel:997");
  });
});
