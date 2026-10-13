import { describe, expect, it } from "vitest";
import { buildSegments, litCount, pathData, pointAtY, revealProgress } from "./handoff";

const YS = [20, 220, 420, 640];
const CENTER = 28;
const SWING = 16;

describe("handoff line geometry", () => {
  const segments = buildSegments(YS, CENTER, SWING);

  it("joins neighbouring nodes", () => {
    expect(segments).toHaveLength(YS.length - 1);
    segments.forEach((segment, index) => {
      expect(segment.p0).toEqual({ x: CENTER, y: YS[index] });
      expect(segment.p1).toEqual({ x: CENTER, y: YS[index + 1] });
      // y never turns back up, so a top-down reveal draws the line in order.
      expect(segment.c1.y).toBeGreaterThanOrEqual(segment.p0.y);
      expect(segment.c2.y).toBeGreaterThanOrEqual(segment.c1.y);
      expect(segment.p1.y).toBeGreaterThanOrEqual(segment.c2.y);
    });
  });

  it("bows to alternating sides", () => {
    expect(segments[0]!.c1.x).toBe(CENTER + SWING);
    expect(segments[1]!.c1.x).toBe(CENTER - SWING);
  });

  it("writes SVG path data", () => {
    const d = pathData(segments);
    expect(d.startsWith("M28 20")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(pathData(buildSegments([10], CENTER, SWING))).toBe("");
  });

  it("finds the point at a given height", () => {
    expect(pointAtY(segments, 5)).toBeNull();
    const start = pointAtY(segments, 20)!;
    expect(start.x).toBeCloseTo(CENTER, 3);
    expect(start.y).toBeCloseTo(20, 3);
    const middle = pointAtY(segments, 120)!;
    expect(middle.y).toBeCloseTo(120, 3);
    expect(middle.x).toBeGreaterThan(CENTER);
    expect(middle.x).toBeLessThanOrEqual(CENTER + SWING);
    expect(pointAtY(segments, 900)).toEqual({ x: CENTER, y: 640 });
    expect(pointAtY([], 100)).toBeNull();
  });

  it("measures reading progress through the block", () => {
    // Reading line at 62% of an 800px viewport = 496px.
    expect(revealProgress(600, 400, 800)).toBe(0);
    expect(revealProgress(296, 400, 800)).toBeCloseTo(0.5);
    expect(revealProgress(-1000, 400, 800)).toBe(1);
    expect(revealProgress(0, 0, 800)).toBe(0);
  });

  it("counts the nodes the line has reached", () => {
    expect(litCount(YS, 0)).toBe(0);
    expect(litCount(YS, 20)).toBe(1);
    expect(litCount(YS, 430)).toBe(3);
    expect(litCount(YS, 10_000)).toBe(4);
  });
});
