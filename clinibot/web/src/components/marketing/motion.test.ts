import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clamp, ENTER_MS, revealStyle, settleDelay, STAGGER_MS, useReducedMotion } from "./motion";

/** A controllable prefers-reduced-motion media query. */
function mockReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return matches;
    },
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.spyOn(window, "matchMedia").mockImplementation(() => query as unknown as MediaQueryList);
  return {
    set(value: boolean) {
      matches = value;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReducedMotion", () => {
  it("follows the OS setting live, in both directions", () => {
    const media = mockReducedMotion(false);
    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});

describe("entrance timing", () => {
  it("staggers items within the 60-150ms range", () => {
    expect(STAGGER_MS).toBeGreaterThanOrEqual(60);
    expect(STAGGER_MS).toBeLessThanOrEqual(150);
  });

  it("retires delays only after the last item has entered", () => {
    expect(settleDelay(1)).toBeGreaterThanOrEqual(ENTER_MS);
    expect(settleDelay(6)).toBeGreaterThanOrEqual(5 * STAGGER_MS + ENTER_MS);
    expect(settleDelay(0)).toBe(settleDelay(1));
  });

  it("places items in the stagger", () => {
    expect(revealStyle(3)).toEqual({ "--mk-i": 3 });
    expect(revealStyle(-2)).toEqual({ "--mk-i": 0 });
  });

  it("clamps", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});
