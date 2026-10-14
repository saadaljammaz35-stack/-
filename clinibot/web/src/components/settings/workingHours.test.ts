import { describe, expect, it } from "vitest";
import {
  DAY_KEYS,
  draftFromHours,
  isValidWorkingHours,
  sameHours,
  serializeHours,
  validateHoursDraft,
  type HoursDraft,
} from "./workingHours";

const DB_DEFAULT = {
  sat: [["09:00", "21:00"]],
  sun: [["09:00", "21:00"]],
  mon: [["09:00", "21:00"]],
  tue: [["09:00", "21:00"]],
  wed: [["09:00", "21:00"]],
  thu: [["09:00", "21:00"]],
  fri: [],
};

function closedWeek(): HoursDraft {
  return draftFromHours({});
}

describe("isValidWorkingHours (mirror of private.valid_working_hours)", () => {
  it("accepts the database default and an empty object", () => {
    expect(isValidWorkingHours(DB_DEFAULT)).toBe(true);
    expect(isValidWorkingHours({})).toBe(true);
  });

  it("accepts up to three ranges and a 24:00 close", () => {
    expect(
      isValidWorkingHours({
        sat: [
          ["08:00", "12:00"],
          ["13:00", "17:00"],
          ["18:00", "24:00"],
        ],
      }),
    ).toBe(true);
  });

  it("rejects what the database rejects", () => {
    expect(isValidWorkingHours(null)).toBe(false);
    expect(isValidWorkingHours([])).toBe(false);
    expect(isValidWorkingHours({ saturday: [] })).toBe(false);
    expect(isValidWorkingHours({ sat: "09:00-21:00" })).toBe(false);
    expect(
      isValidWorkingHours({
        sat: [
          ["01:00", "02:00"],
          ["03:00", "04:00"],
          ["05:00", "06:00"],
          ["07:00", "08:00"],
        ],
      }),
    ).toBe(false);
    expect(isValidWorkingHours({ sat: [["09:00"]] })).toBe(false);
    expect(isValidWorkingHours({ sat: [["9:00", "21:00"]] })).toBe(false);
    expect(isValidWorkingHours({ sat: [["24:00", "24:00"]] })).toBe(false); // open cannot be 24:00
    expect(isValidWorkingHours({ sat: [["21:00", "09:00"]] })).toBe(false);
    expect(isValidWorkingHours({ sat: [["09:00", "09:00"]] })).toBe(false);
    expect(isValidWorkingHours({ sat: [["09:00", "24:30"]] })).toBe(false);
    expect(isValidWorkingHours({ sat: [[9, 21]] })).toBe(false);
  });

  it("like the database, does not check overlaps", () => {
    expect(
      isValidWorkingHours({
        sat: [
          ["09:00", "13:00"],
          ["12:00", "15:00"],
        ],
      }),
    ).toBe(true);
  });
});

describe("draftFromHours", () => {
  it("shows a stored week day by day", () => {
    const draft = draftFromHours(DB_DEFAULT);
    expect(draft.sat).toEqual({ isOpen: true, ranges: [{ open: "09:00", close: "21:00" }] });
    expect(draft.fri).toEqual({ isOpen: false, ranges: [] });
  });

  it("shows a midnight close as 00:00 for the time input", () => {
    expect(draftFromHours({ thu: [["16:00", "24:00"]] }).thu.ranges).toEqual([
      { open: "16:00", close: "00:00" },
    ]);
  });

  it("treats missing or malformed days as closed instead of guessing", () => {
    const draft = draftFromHours({ sat: [["21:00", "09:00"]], sun: "all day" });
    expect(draft.sat.isOpen).toBe(false);
    expect(draft.sun.isOpen).toBe(false);
    expect(draft.mon.isOpen).toBe(false);
    expect(draftFromHours(null).sat.isOpen).toBe(false);
  });
});

describe("validateHoursDraft", () => {
  it("round-trips the database default exactly", () => {
    const result = validateHoursDraft(draftFromHours(DB_DEFAULT));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hours).toEqual(DB_DEFAULT);
    expect(isValidWorkingHours(result.hours)).toBe(true);
  });

  it("stores closed days as empty lists and keeps every day", () => {
    const result = validateHoursDraft(closedWeek());
    expect(result).toEqual({
      ok: true,
      hours: { sat: [], sun: [], mon: [], tue: [], wed: [], thu: [], fri: [] },
    });
  });

  it("turns a 00:00 close back into 24:00 and sorts ranges", () => {
    const draft = closedWeek();
    draft.thu = {
      isOpen: true,
      ranges: [
        { open: "17:00", close: "00:00" },
        { open: "09:00", close: "13:00" },
      ],
    };
    const result = validateHoursDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hours.thu).toEqual([
      ["09:00", "13:00"],
      ["17:00", "24:00"],
    ]);
    expect(isValidWorkingHours(result.hours)).toBe(true);
  });

  it("reports one problem per day", () => {
    const draft = closedWeek();
    draft.sat = { isOpen: true, ranges: [] };
    draft.sun = { isOpen: true, ranges: [{ open: "09:00", close: "" }] };
    draft.mon = { isOpen: true, ranges: [{ open: "21:00", close: "09:00" }] };
    draft.tue = {
      isOpen: true,
      ranges: [
        { open: "09:00", close: "13:00" },
        { open: "12:30", close: "16:00" },
      ],
    };
    draft.wed = {
      isOpen: true,
      ranges: [
        { open: "01:00", close: "02:00" },
        { open: "03:00", close: "04:00" },
        { open: "05:00", close: "06:00" },
        { open: "07:00", close: "08:00" },
      ],
    };
    draft.thu = { isOpen: true, ranges: [{ open: "10:00", close: "10:00" }] };
    expect(validateHoursDraft(draft)).toEqual({
      ok: false,
      errors: {
        sat: "noRanges",
        sun: "incomplete",
        mon: "closeBeforeOpen",
        tue: "overlap",
        wed: "tooMany",
        thu: "closeBeforeOpen",
      },
    });
  });

  it("allows ranges that touch", () => {
    const draft = closedWeek();
    draft.sat = {
      isOpen: true,
      ranges: [
        { open: "09:00", close: "13:00" },
        { open: "13:00", close: "17:00" },
      ],
    };
    expect(validateHoursDraft(draft).ok).toBe(true);
  });

  it("ignores the ranges of a closed day", () => {
    const draft = closedWeek();
    draft.fri = { isOpen: false, ranges: [{ open: "", close: "" }] };
    const result = validateHoursDraft(draft);
    expect(result.ok && result.hours.fri).toEqual([]);
  });
});

describe("serializeHours", () => {
  it("writes the exact JSON shape, Saturday first", () => {
    const result = validateHoursDraft(draftFromHours(DB_DEFAULT));
    if (!result.ok) throw new Error("expected valid hours");
    expect(serializeHours(result.hours)).toBe(
      '{"sat":[["09:00","21:00"]],"sun":[["09:00","21:00"]],"mon":[["09:00","21:00"]],' +
        '"tue":[["09:00","21:00"]],"wed":[["09:00","21:00"]],"thu":[["09:00","21:00"]],"fri":[]}',
    );
    expect(Object.keys(JSON.parse(serializeHours(result.hours)) as object)).toEqual([...DAY_KEYS]);
  });
});

describe("sameHours", () => {
  it("detects unsaved changes", () => {
    const a = draftFromHours(DB_DEFAULT);
    const b = draftFromHours(DB_DEFAULT);
    expect(sameHours(a, b)).toBe(true);
    b.sat = { isOpen: true, ranges: [{ open: "10:00", close: "21:00" }] };
    expect(sameHours(a, b)).toBe(false);
    const closedA = closedWeek();
    const closedB = closedWeek();
    closedB.fri = { isOpen: false, ranges: [{ open: "09:00", close: "10:00" }] };
    expect(sameHours(closedA, closedB)).toBe(true);
  });
});
