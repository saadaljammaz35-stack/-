/**
 * Working hours as stored in clinic_settings.working_hours:
 *   {"sat":[["09:00","21:00"]], …, "fri":[]}
 * Each day is closed ([]) or has up to three [open, close] ranges, "HH:MM",
 * open < close; "24:00" closes at midnight. isValidWorkingHours() mirrors the
 * database check private.valid_working_hours exactly; the editor adds one
 * stricter rule (ranges of the same day may not overlap).
 */

/** Saudi week order: Saturday … Friday. */
export const DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const MAX_RANGES = 3;

export type TimeRange = readonly [open: string, close: string];
export type WorkingHours = Record<DayKey, TimeRange[]>;

const OPEN_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const CLOSE_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$/;
const MIDNIGHT_END = "24:00";

function isDayKey(value: string): value is DayKey {
  return (DAY_KEYS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Same rules as the SQL function private.valid_working_hours(jsonb). */
export function isValidWorkingHours(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  for (const [day, ranges] of Object.entries(value)) {
    if (!isDayKey(day)) return false;
    if (!Array.isArray(ranges) || ranges.length > MAX_RANGES) return false;
    for (const range of ranges as unknown[]) {
      if (!Array.isArray(range) || range.length !== 2) return false;
      const [open, close] = range as unknown[];
      if (typeof open !== "string" || typeof close !== "string") return false;
      if (!OPEN_TIME.test(open) || !CLOSE_TIME.test(close) || open >= close) return false;
    }
  }
  return true;
}

// ───────────────────────────── editor draft ─────────────────────────────

/** What the editor shows. Times are "HH:MM" as typed; "" while empty. */
export interface RangeDraft {
  open: string;
  close: string;
}

export interface DayDraft {
  isOpen: boolean;
  ranges: RangeDraft[];
}

export type HoursDraft = Record<DayKey, DayDraft>;

/** A new opening day starts with the database default, 09:00–21:00. */
export const DEFAULT_RANGE: RangeDraft = { open: "09:00", close: "21:00" };

/**
 * Time inputs cannot show 24:00, so a midnight close is edited as 00:00 and
 * turned back into 24:00 when saved.
 */
function closeForEditor(close: string): string {
  return close === MIDNIGHT_END ? "00:00" : close;
}

function closeForStorage(close: string): string {
  return close === "00:00" ? MIDNIGHT_END : close;
}

/**
 * Builds the editor state from whatever is stored. A day that is missing or
 * malformed is shown as closed rather than guessed.
 */
export function draftFromHours(value: unknown): HoursDraft {
  const source = isPlainObject(value) ? value : {};
  const draft = {} as HoursDraft;
  for (const day of DAY_KEYS) {
    const ranges: RangeDraft[] = [];
    const stored = source[day];
    if (Array.isArray(stored) && isValidWorkingHours({ [day]: stored })) {
      for (const range of stored as [string, string][]) {
        ranges.push({ open: range[0], close: closeForEditor(range[1]) });
      }
    }
    draft[day] = { isOpen: ranges.length > 0, ranges };
  }
  return draft;
}

export type DayError =
  /** Open, but no hours entered. */
  | "noRanges"
  /** A start or end time is missing or not HH:MM. */
  | "incomplete"
  /** A range closes at or before it opens. */
  | "closeBeforeOpen"
  /** Two ranges of the same day overlap. */
  | "overlap"
  | "tooMany";

export type HoursValidation =
  { ok: true; hours: WorkingHours } | { ok: false; errors: Partial<Record<DayKey, DayError>> };

function dayError(day: DayDraft): DayError | null {
  if (!day.isOpen) return null;
  if (day.ranges.length === 0) return "noRanges";
  if (day.ranges.length > MAX_RANGES) return "tooMany";
  for (const range of day.ranges) {
    if (!OPEN_TIME.test(range.open) || !OPEN_TIME.test(range.close)) return "incomplete";
    if (range.open >= closeForStorage(range.close)) return "closeBeforeOpen";
  }
  const sorted = [...day.ranges].sort((a, b) => a.open.localeCompare(b.open));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current.open < closeForStorage(previous.close)) return "overlap";
  }
  return null;
}

/**
 * Validates the editor state and, when valid, returns the value to store:
 * every day present in Saudi week order, ranges sorted by start time.
 */
export function validateHoursDraft(draft: HoursDraft): HoursValidation {
  const errors: Partial<Record<DayKey, DayError>> = {};
  const hours = {} as WorkingHours;
  for (const day of DAY_KEYS) {
    const value = draft[day];
    const error = dayError(value);
    if (error) {
      errors[day] = error;
      continue;
    }
    hours[day] = value.isOpen
      ? [...value.ranges]
          .sort((a, b) => a.open.localeCompare(b.open))
          .map((range) => [range.open, closeForStorage(range.close)] as const)
      : [];
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, hours };
}

/** The exact JSON text the database receives (keys in Saudi week order). */
export function serializeHours(hours: WorkingHours): string {
  const ordered: Record<string, TimeRange[]> = {};
  for (const day of DAY_KEYS) ordered[day] = hours[day];
  return JSON.stringify(ordered);
}

/** True when two drafts would save the same hours (used to detect unsaved edits). */
export function sameHours(a: HoursDraft, b: HoursDraft): boolean {
  return DAY_KEYS.every((day) => {
    const left = a[day];
    const right = b[day];
    if (left.isOpen !== right.isOpen) return false;
    if (!left.isOpen) return true;
    return (
      left.ranges.length === right.ranges.length &&
      left.ranges.every(
        (range, index) =>
          range.open === right.ranges[index]?.open && range.close === right.ranges[index]?.close,
      )
    );
  });
}
