import { describe, expect, it } from "vitest";
import { setupChecklist, setupProgress, type SetupState } from "./setup";

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
