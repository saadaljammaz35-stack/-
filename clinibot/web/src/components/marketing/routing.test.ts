import { describe, expect, it } from "vitest";
import marketing from "@/i18n/messages/marketing";
import {
  FINAL_STAGE,
  ROUTES,
  RULE_PRECEDENCE,
  SCENARIOS,
  routeFor,
  routeIndex,
  routeInfo,
  stageTimeline,
  trunkDelay,
  trunkFill,
} from "./routing";

const text = (lang: "ar" | "en", key: string) =>
  (marketing[lang] as Record<string, string>)[key.replace(/^marketing\./, "")] ?? "";

describe("routing illustration", () => {
  it("sends each sample message down the path the assistant's rules take", () => {
    expect(routeFor("price")).toBe("answer");
    expect(routeFor("booking")).toBe("booking");
    expect(routeFor("medical")).toBe("handoff");
    expect(routeFor("emergency")).toBe("emergency");
  });

  it("uses the requested sample messages", () => {
    const medical = SCENARIOS.find((item) => item.id === "medical")!;
    const emergency = SCENARIOS.find((item) => item.id === "emergency")!;
    expect(text("ar", medical.message)).toBe("أعاني من ألم في ضرسي، ماذا آخذ؟");
    expect(text("ar", emergency.message)).toBe("ألم شديد في الصدر");
  });

  it("reaches every destination with exactly one sample", () => {
    const routes = SCENARIOS.map((item) => item.route).sort();
    expect(routes).toEqual(ROUTES.map((route) => route.id).sort());
  });

  it("puts emergencies first and the plain answer last in rule precedence", () => {
    expect(RULE_PRECEDENCE[0]).toBe("emergency");
    expect(RULE_PRECEDENCE[RULE_PRECEDENCE.length - 1]).toBe("answer");
    expect([...RULE_PRECEDENCE].sort()).toEqual(ROUTES.map((route) => route.id).sort());
  });

  it("points emergencies to 997 in both languages", () => {
    const info = routeInfo("emergency");
    for (const lang of ["ar", "en"] as const) {
      expect(text(lang, info.label)).toContain("997");
      expect(text(lang, info.result)).toContain("997");
    }
  });

  it("never describes a booking as confirmed by the assistant", () => {
    const info = routeInfo("booking");
    expect(text("en", info.result)).toMatch(/never confirms/);
    expect(text("ar", info.result)).toContain("لا يؤكد الموعد بنفسه");
  });

  it("jumps straight to the final stage with reduced motion", () => {
    expect(stageTimeline(true)).toEqual([{ stage: FINAL_STAGE, at: 0 }]);
  });

  it("plays the stages in order otherwise", () => {
    const timeline = stageTimeline(false);
    expect(timeline.map((step) => step.stage)).toEqual([1, 2, 3]);
    const times = timeline.map((step) => step.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(0);
    expect(timeline[timeline.length - 1]!.stage).toBe(FINAL_STAGE);
  });

  it("fills the trunk down to the chosen row only", () => {
    const rows = ROUTES.length;
    const chosen = routeIndex("handoff");
    expect(ROUTES.map((_, row) => trunkFill(row, chosen, rows))).toEqual([1, 1, 0.5, 0]);
    // The last row's track already ends at its middle.
    expect(trunkFill(rows - 1, rows - 1, rows)).toBe(1);
    expect(trunkFill(0, -1, rows)).toBe(0);
  });

  it("staggers the trunk row by row", () => {
    expect(trunkDelay(0)).toBe(0);
    expect(trunkDelay(2)).toBeGreaterThan(trunkDelay(1));
  });
});
