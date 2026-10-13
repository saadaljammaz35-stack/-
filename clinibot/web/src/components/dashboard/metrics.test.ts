import { describe, expect, it } from "vitest";
import { formatNumber } from "@/i18n/format";
import { translate } from "@/i18n/translate";
import type { Lang, TFunction } from "@/i18n";
import {
  fillDailySeries,
  formatResponseTime,
  niceTicks,
  parseDashboardMetrics,
  splitDuration,
} from "./metrics";

function tFor(lang: Lang): TFunction {
  return (key, params) => translate(lang, key, params);
}
const fmt = (lang: Lang) => (value: number, options?: Intl.NumberFormatOptions) =>
  formatNumber(lang, value, options);

describe("response-time formatting", () => {
  it("picks seconds, minutes or hours", () => {
    expect(splitDuration(45)).toEqual({ value: 45, unit: "seconds" });
    expect(splitDuration(59.6)).toEqual({ value: 1, unit: "minutes" });
    expect(splitDuration(170)).toEqual({ value: 3, unit: "minutes" });
    expect(splitDuration(3599)).toEqual({ value: 1, unit: "hours" });
    expect(splitDuration(5400)).toEqual({ value: 1.5, unit: "hours" });
    expect(splitDuration(40_000)).toEqual({ value: 11, unit: "hours" });
    expect(splitDuration(0)).toEqual({ value: 0, unit: "seconds" });
  });

  it("formats in Arabic", () => {
    const t = tFor("ar");
    expect(formatResponseTime(45, t, fmt("ar"))).toBe("45 ث");
    expect(formatResponseTime(180, t, fmt("ar"))).toBe("3 د");
    expect(formatResponseTime(3600, t, fmt("ar"))).toBe("1 س");
    expect(formatResponseTime(5400, t, fmt("ar"))).toBe("1.5 س");
  });

  it("formats in English", () => {
    const t = tFor("en");
    expect(formatResponseTime(45, t, fmt("en"))).toBe("45s");
    expect(formatResponseTime(180, t, fmt("en"))).toBe("3 min");
    expect(formatResponseTime(3600, t, fmt("en"))).toBe("1 h");
  });

  it("returns null when there is no data, so nothing is invented", () => {
    const t = tFor("en");
    expect(formatResponseTime(null, t, fmt("en"))).toBeNull();
    expect(formatResponseTime(undefined, t, fmt("en"))).toBeNull();
    expect(formatResponseTime(Number.NaN, t, fmt("en"))).toBeNull();
  });
});

describe("parseDashboardMetrics", () => {
  it("reads the RPC payload", () => {
    const metrics = parseDashboardMetrics({
      since: "2026-10-05T12:00:00Z",
      total_conversations: 12,
      unanswered_conversations: 3,
      appointment_requests: 4,
      confirmed_appointments: 1,
      avg_first_response_seconds: 95,
      median_first_response_seconds: null,
      responded_conversations: 9,
      conversations_by_channel: { web: 5, whatsapp: 7 },
      daily_conversations: [{ day: "2026-10-06", count: 2 }],
    });
    expect(metrics.totalConversations).toBe(12);
    expect(metrics.unansweredConversations).toBe(3);
    expect(metrics.avgFirstResponseSeconds).toBe(95);
    expect(metrics.medianFirstResponseSeconds).toBeNull();
    expect(metrics.byChannel).toEqual({ web: 5, whatsapp: 7 });
    expect(metrics.daily).toEqual([{ day: "2026-10-06", count: 2 }]);
  });

  it("shows zero, not a placeholder, for missing counts", () => {
    const metrics = parseDashboardMetrics({});
    expect(metrics.totalConversations).toBe(0);
    expect(metrics.byChannel).toEqual({ web: 0, whatsapp: 0 });
    expect(metrics.avgFirstResponseSeconds).toBeNull();
    expect(metrics.daily).toEqual([]);
    expect(parseDashboardMetrics(null).appointmentRequests).toBe(0);
  });
});

describe("fillDailySeries", () => {
  const now = new Date("2026-10-12T09:00:00Z"); // 12:00 in Riyadh

  it("fills every day of the period with 0 where nothing happened", () => {
    const series = fillDailySeries(
      [
        { day: "2026-10-07", count: 3 },
        { day: "2026-10-12", count: 1 },
      ],
      "2026-10-05T09:00:00Z",
      7,
      now,
    );
    expect(series.map((point) => point.day)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(series.map((point) => point.count)).toEqual([0, 0, 3, 0, 0, 0, 0, 1]);
  });

  it("uses the Riyadh date for the start of the period", () => {
    // 22:30 UTC is already the next day in Riyadh.
    const series = fillDailySeries([], "2026-10-04T22:30:00Z", 7, now);
    expect(series[0]?.day).toBe("2026-10-05");
  });

  it("never drops a day the server returned", () => {
    const series = fillDailySeries(
      [{ day: "2026-10-01", count: 2 }],
      "2026-10-05T09:00:00Z",
      7,
      now,
    );
    expect(series[0]).toEqual({ day: "2026-10-01", count: 2 });
    expect(series.reduce((sum, point) => sum + point.count, 0)).toBe(2);
  });

  it("works without a since timestamp", () => {
    const series = fillDailySeries([], null, 7, now);
    expect(series).toHaveLength(8);
    expect(series.every((point) => point.count === 0)).toBe(true);
  });
});

describe("niceTicks", () => {
  it("chooses clean steps", () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(100)).toEqual([0, 50, 100]);
    expect(niceTicks(1)).toEqual([0, 1]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
