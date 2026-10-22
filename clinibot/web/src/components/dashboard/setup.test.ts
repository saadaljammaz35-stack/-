import { describe, expect, it } from "vitest";
import {
  setupChecklist,
  setupProgress,
  testStepDone,
  whatsappReceiving,
  type SetupState,
} from "./setup";

const allDone: SetupState = {
  hasKnowledge: true,
  assistantTested: true,
  assistantEnabled: true,
  publicChatEnabled: true,
  whatsappConnected: true,
  hasTeammate: true,
};

describe("setup checklist", () => {
  it("is complete only when every check is true", () => {
    expect(setupProgress(setupChecklist(allDone))).toEqual({ done: 6, total: 6, complete: true });
  });

  it("never counts an unknown check as done", () => {
    const items = setupChecklist({ ...allDone, whatsappConnected: null });
    expect(items.find((item) => item.id === "whatsappConnected")?.state).toBe("unknown");
    expect(setupProgress(items)).toEqual({ done: 5, total: 6, complete: false });
  });

  it("marks false checks as to do and links each to its page", () => {
    const items = setupChecklist({ ...allDone, hasKnowledge: false, hasTeammate: false });
    expect(items.filter((item) => item.state === "todo").map((item) => item.to)).toEqual([
      "/app/knowledge",
      "/app/staff",
    ]);
  });
});

describe("testStepDone", () => {
  const NOW = new Date("2026-10-13T12:00:00Z");
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

  it("counts a passing test only while it can still unlock the assistant", () => {
    const old = { lastTestOk: true, lastTestAt: daysAgo(40) };
    expect(testStepDone({ assistantEnabled: false, ...old }, NOW)).toBe(false);
    expect(
      testStepDone({ assistantEnabled: false, lastTestOk: true, lastTestAt: daysAgo(2) }, NOW),
    ).toBe(true);
  });

  it("keeps an old passing test done once the assistant is on", () => {
    expect(
      testStepDone({ assistantEnabled: true, lastTestOk: true, lastTestAt: daysAgo(40) }, NOW),
    ).toBe(true);
  });

  it("is never done after a failed last test, even with the assistant on", () => {
    expect(
      testStepDone({ assistantEnabled: true, lastTestOk: false, lastTestAt: daysAgo(2) }, NOW),
    ).toBe(false);
    expect(testStepDone({ assistantEnabled: false, lastTestOk: null, lastTestAt: null }, NOW)).toBe(
      false,
    );
  });
});

describe("whatsappReceiving", () => {
  it("needs Meta's verification AND a first incoming message", () => {
    expect(
      whatsappReceiving({ status: "connected", last_inbound_at: "2026-10-12T09:00:00Z" }),
    ).toBe(true);
    // Verified at "Verify and save", but the app may not be subscribed to "messages" yet.
    expect(whatsappReceiving({ status: "connected", last_inbound_at: null })).toBe(false);
    expect(whatsappReceiving({ status: "connected" })).toBe(false);
    expect(
      whatsappReceiving({
        status: "credentials_verified",
        last_inbound_at: "2026-10-12T09:00:00Z",
      }),
    ).toBe(false);
    expect(whatsappReceiving(null)).toBe(false);
  });
});
