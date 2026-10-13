import { describe, expect, it } from "vitest";
import { bandIndexAt, bandLeft, columnPath, columnWidth, labelIndices } from "./chartGeometry";

describe("chart geometry", () => {
  it("caps columns at 24px and keeps a 2px gap", () => {
    expect(columnWidth(40)).toBe(24);
    expect(columnWidth(10)).toBe(8);
    expect(columnWidth(2)).toBe(1);
  });

  it("draws nothing for a zero column", () => {
    expect(columnPath(0, 10, 8, 0)).toBe("");
    expect(columnPath(0, 10, 8, 20)).toMatch(/^M0,30 V14 /);
  });

  it("spreads labels and always shows the first and last day", () => {
    expect(labelIndices(8, 600)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const labels = labelIndices(91, 300);
    expect(labels[0]).toBe(0);
    expect(labels[labels.length - 1]).toBe(90);
    expect(labels.length).toBeLessThanOrEqual(5);
    expect(labelIndices(1, 300)).toEqual([0]);
    expect(labelIndices(0, 300)).toEqual([]);
  });

  it("maps a pointer to a band in both directions", () => {
    expect(bandIndexAt(5, 100, 10, false)).toBe(0);
    expect(bandIndexAt(95, 100, 10, false)).toBe(9);
    expect(bandIndexAt(95, 100, 10, true)).toBe(0);
    expect(bandIndexAt(5, 100, 10, true)).toBe(9);
    expect(bandIndexAt(500, 100, 10, false)).toBe(9);
    expect(bandLeft(0, 100, 10, true)).toBe(90);
    expect(bandLeft(0, 100, 10, false)).toBe(0);
  });
});
