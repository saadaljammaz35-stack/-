import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { DailyConversationsChart } from "./DailyConversationsChart";
import type { DailyPoint } from "./metrics";

const POINTS: DailyPoint[] = [
  { day: "2026-10-06", count: 0 },
  { day: "2026-10-07", count: 2 },
  { day: "2026-10-08", count: 0 },
  { day: "2026-10-09", count: 5 },
  { day: "2026-10-10", count: 1 },
  { day: "2026-10-11", count: 0 },
  { day: "2026-10-12", count: 3 },
];

/** x of a column path ("M{x},{y} …"). */
function columnX(path: Element): number {
  return Number(/^M([\d.]+),/.exec(path.getAttribute("d") ?? "")?.[1]);
}

describe("DailyConversationsChart", () => {
  beforeEach(() => {
    // jsdom has no layout: give the chart a phone-sized width to draw into.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 343,
      height: 228,
      top: 0,
      left: 0,
      right: 343,
      bottom: 228,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("draws one column per day with conversations, and labels only the busiest day", () => {
    const { container } = renderWithProviders(<DailyConversationsChart points={POINTS} />, {
      lang: "en",
    });
    expect(container.querySelectorAll("svg path")).toHaveLength(4);
    const labels = [...container.querySelectorAll("svg text")].map((node) => node.textContent);
    expect(labels.filter((text) => text === "5")).toHaveLength(1);
    // The same numbers as a table, one row per day (zeros included).
    expect(screen.getAllByRole("row")).toHaveLength(POINTS.length + 1);
  });

  it("runs time with the reading direction", () => {
    const ltr = renderWithProviders(<DailyConversationsChart points={POINTS} />, { lang: "en" });
    const ltrColumns = [...ltr.container.querySelectorAll("svg path")];
    expect(columnX(ltrColumns[0]!)).toBeLessThan(columnX(ltrColumns[ltrColumns.length - 1]!));
    ltr.unmount();

    const rtl = renderWithProviders(<DailyConversationsChart points={POINTS} />, { lang: "ar" });
    const rtlColumns = [...rtl.container.querySelectorAll("svg path")];
    expect(columnX(rtlColumns[0]!)).toBeGreaterThan(columnX(rtlColumns[rtlColumns.length - 1]!));
  });

  it("announces the focused day and moves with the arrow keys", () => {
    renderWithProviders(<DailyConversationsChart points={POINTS} />, { lang: "en" });
    const chart = screen.getByRole("group", { name: "Daily conversations" });
    fireEvent.focus(chart);
    expect(screen.getByText("Monday 12 October: 3 conversations")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Sunday 11 October: 0 conversations")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "Home" });
    expect(screen.getByText("Tuesday 6 October: 0 conversations")).toBeInTheDocument();
  });

  it("says so plainly when the period has no conversations", () => {
    const empty = POINTS.map((point) => ({ ...point, count: 0 }));
    const { container } = renderWithProviders(<DailyConversationsChart points={empty} />, {
      lang: "ar",
    });
    expect(screen.getByText("لا توجد محادثات جديدة في هذه الفترة.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
