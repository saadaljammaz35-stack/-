import type { TFunction } from "@/i18n";
import { addDays, isDateKey, riyadhDateKey } from "./time";

/** What `rpc dashboard_metrics(p_org, p_days)` returns, normalised. */
export interface DashboardMetrics {
  since: string | null;
  totalConversations: number;
  activeConversations: number;
  unansweredConversations: number;
  awaitingHuman: number;
  appointmentRequests: number;
  newAppointmentRequests: number;
  confirmedAppointments: number;
  avgFirstResponseSeconds: number | null;
  medianFirstResponseSeconds: number | null;
  respondedConversations: number;
  byChannel: { web: number; whatsapp: number };
  daily: DailyPoint[];
}

export interface DailyPoint {
  /** Riyadh calendar date, "YYYY-MM-DD". */
  day: string;
  count: number;
}

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return PERIODS.includes(Number(value) as Period);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** A non-negative whole count; anything missing or malformed is 0 (the RPC counts with count(*)). */
function count(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0
    ? Math.round(number)
    : 0;
}

/** Null means "no data" (e.g. no conversation was answered in the period). */
function seconds(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseDashboardMetrics(json: unknown): DashboardMetrics {
  const data = record(json);
  const channels = record(data.conversations_by_channel);
  const daily: DailyPoint[] = [];
  if (Array.isArray(data.daily_conversations)) {
    for (const item of data.daily_conversations) {
      const row = record(item);
      const day = typeof row.day === "string" ? row.day.slice(0, 10) : "";
      if (isDateKey(day)) daily.push({ day, count: count(row.count) });
    }
  }
  return {
    since: typeof data.since === "string" ? data.since : null,
    totalConversations: count(data.total_conversations),
    activeConversations: count(data.active_conversations),
    unansweredConversations: count(data.unanswered_conversations),
    awaitingHuman: count(data.awaiting_human),
    appointmentRequests: count(data.appointment_requests),
    newAppointmentRequests: count(data.new_appointment_requests),
    confirmedAppointments: count(data.confirmed_appointments),
    avgFirstResponseSeconds: seconds(data.avg_first_response_seconds),
    medianFirstResponseSeconds: seconds(data.median_first_response_seconds),
    respondedConversations: count(data.responded_conversations),
    byChannel: { web: count(channels.web), whatsapp: count(channels.whatsapp) },
    daily,
  };
}

/**
 * One point per Riyadh calendar day from the start of the period to today,
 * with 0 for days without conversations. The period starts `days` days ago
 * (a partial first day), so a 7-day period can span 8 calendar days. Days the
 * server returned outside that range are kept, never dropped.
 */
export function fillDailySeries(
  daily: readonly DailyPoint[],
  since: string | null,
  days: number,
  now: Date = new Date(),
): DailyPoint[] {
  const today = riyadhDateKey(now);
  let start = since ? riyadhDateKey(since) : "";
  if (!start) start = addDays(today, -days);
  let end = today;
  const counts = new Map<string, number>();
  for (const point of daily) {
    counts.set(point.day, (counts.get(point.day) ?? 0) + point.count);
    if (point.day < start) start = point.day;
    if (point.day > end) end = point.day;
  }
  const series: DailyPoint[] = [];
  // Guard against a runaway loop on bad input (a year and a bit is plenty).
  for (let day = start, i = 0; day <= end && i < 400; day = addDays(day, 1), i += 1) {
    series.push({ day, count: counts.get(day) ?? 0 });
  }
  return series;
}

/**
 * Clean axis ticks from 0 to at least `max`, with steps of 1, 2 or 5 × 10ⁿ
 * and at most about `target` intervals: max 7 → 0, 2, 4, 6, 8.
 */
export function niceTicks(max: number, target = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Counts are whole numbers, so the step never goes below 1.
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw,
  );
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Math.round(value));
  return ticks;
}

export type DurationUnit = "seconds" | "minutes" | "hours";

/** 45 → 45 s; 170 → 3 min; 3599 → 1 h; 5400 → 1.5 h; 40000 → 11 h. */
export function splitDuration(totalSeconds: number): { value: number; unit: DurationUnit } {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return { value: s, unit: "seconds" };
  const minutes = Math.round(s / 60);
  if (minutes < 60) return { value: minutes, unit: "minutes" };
  const hours = s / 3600;
  return { value: hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours), unit: "hours" };
}

/**
 * "45 ث" / "3 د" / "1 س" (ar), "45s" / "3 min" / "1 h" (en). Null when there
 * is no data, so the caller can say so instead of showing a made-up number.
 */
export function formatResponseTime(
  value: number | null | undefined,
  t: TFunction,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  const { value: amount, unit } = splitDuration(value);
  const n = formatNumber(amount, { maximumFractionDigits: 1 });
  if (unit === "seconds") return t("dashboard.durationSeconds", { n });
  if (unit === "minutes") return t("dashboard.durationMinutes", { n });
  return t("dashboard.durationHours", { n });
}
