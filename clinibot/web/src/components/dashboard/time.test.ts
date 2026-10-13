import { describe, expect, it } from "vitest";
import {
  addDays,
  formatRelativeTime,
  isDateKey,
  riyadhDateKey,
  riyadhLocalToUtcIso,
  riyadhToday,
  utcToRiyadhLocal,
} from "./time";

describe("Riyadh local time ↔ UTC", () => {
  it("converts a Riyadh wall-clock time to UTC (UTC+3, no DST)", () => {
    expect(riyadhLocalToUtcIso("2026-10-15", "16:30")).toBe("2026-10-15T13:30:00.000Z");
    // Summer and winter give the same offset.
    expect(riyadhLocalToUtcIso("2026-07-01", "09:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(riyadhLocalToUtcIso("2026-01-01", "09:00")).toBe("2026-01-01T06:00:00.000Z");
  });

  it("crosses midnight backwards into the previous UTC day", () => {
    expect(riyadhLocalToUtcIso("2026-10-15", "01:15")).toBe("2026-10-14T22:15:00.000Z");
    expect(riyadhLocalToUtcIso("2027-01-01", "00:00")).toBe("2026-12-31T21:00:00.000Z");
  });

  it("rejects invalid input", () => {
    expect(riyadhLocalToUtcIso("2026-02-30", "10:00")).toBeNull();
    expect(riyadhLocalToUtcIso("2026-10-15", "24:00")).toBeNull();
    expect(riyadhLocalToUtcIso("15/10/2026", "10:00")).toBeNull();
    expect(riyadhLocalToUtcIso("2026-10-15", "9:00")).toBeNull();
  });

  it("converts UTC back to the Riyadh wall clock", () => {
    expect(utcToRiyadhLocal("2026-10-15T13:30:00.000Z")).toEqual({
      date: "2026-10-15",
      time: "16:30",
    });
    expect(utcToRiyadhLocal("2026-10-14T22:15:00Z")).toEqual({ date: "2026-10-15", time: "01:15" });
    expect(utcToRiyadhLocal("2026-10-15T13:30:00+00:00")).toEqual({
      date: "2026-10-15",
      time: "16:30",
    });
    expect(utcToRiyadhLocal("not a date")).toBeNull();
  });

  it("round-trips", () => {
    const iso = riyadhLocalToUtcIso("2026-03-09", "23:45")!;
    expect(utcToRiyadhLocal(iso)).toEqual({ date: "2026-03-09", time: "23:45" });
  });

  it("knows the Riyadh calendar date of an instant", () => {
    expect(riyadhDateKey("2026-10-12T20:59:00Z")).toBe("2026-10-12");
    expect(riyadhDateKey("2026-10-12T21:00:00Z")).toBe("2026-10-13");
    expect(riyadhToday(new Date("2026-10-12T22:00:00Z"))).toBe("2026-10-13");
    expect(riyadhDateKey("garbage")).toBe("");
  });
});

describe("date keys", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("validates calendar dates", () => {
    expect(isDateKey("2026-10-12")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-1-2")).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-12T12:00:00Z");

  it("uses natural relative phrases", () => {
    expect(formatRelativeTime("en", "2026-10-12T11:59:30Z", now)).toBe("now");
    expect(formatRelativeTime("en", "2026-10-12T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("en", "2026-10-12T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("en", "2026-10-11T10:00:00Z", now)).toBe("yesterday");
    expect(formatRelativeTime("ar", "2026-10-12T11:55:00Z", now)).toBe("قبل 5 دقائق");
  });

  it("treats a timestamp slightly in the future as now", () => {
    expect(formatRelativeTime("en", "2026-10-12T12:00:20Z", now)).toBe("now");
  });

  it("falls back to the date after a week", () => {
    expect(formatRelativeTime("en", "2026-09-01T10:00:00Z", now)).toBe("1 Sept");
    expect(formatRelativeTime("en", "2025-09-01T10:00:00Z", now)).toBe("1 Sept 2025");
  });
});
