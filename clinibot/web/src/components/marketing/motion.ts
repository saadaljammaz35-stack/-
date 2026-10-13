import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react";

/**
 * Motion helpers for the public site. Every animated element reads
 * useReducedMotion(), which follows the OS setting live in both directions.
 */

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function reducedMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_QUERY);
}

function subscribeReduced(onChange: () => void): () => void {
  const query = reducedMediaQuery();
  if (!query) return () => {};
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  // Safari < 14
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function readReduced(): boolean {
  return reducedMediaQuery()?.matches ?? false;
}

/** True while the visitor asks for reduced motion; re-renders when the setting flips. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, readReduced, () => false);
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function readVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/** False while the browser tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, readVisible, () => true);
}

export interface InViewOptions {
  rootMargin?: string;
  threshold?: number;
  /** Stop observing after the first time the element is in view. */
  once?: boolean;
}

/**
 * Whether the element is (or, with `once`, has been) in the viewport.
 * Without IntersectionObserver (old browsers, tests) everything counts as visible.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin = "0px", threshold = 0, once = false }: InViewOptions = {},
): boolean {
  const supported = typeof IntersectionObserver !== "undefined";
  const [inView, setInView] = useState(!supported);

  useEffect(() => {
    const element = ref.current;
    if (!element || !supported) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setInView(visible);
        if (visible && once) observer.disconnect();
      },
      { rootMargin, threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, once, supported]);

  return inView;
}

/** Stagger step between items entering together (ms). Matches --mk-stagger in marketing.css. */
export const STAGGER_MS = 90;
/** Entrance duration (ms). Matches --mk-enter in marketing.css. */
export const ENTER_MS = 640;

/** Time after which a group's entrance delays can be retired. */
export function settleDelay(itemCount: number): number {
  const count = Math.max(1, Math.floor(itemCount));
  return (count - 1) * STAGGER_MS + ENTER_MS + 80;
}

/** Inline style that places an item in its group's entrance stagger. */
export function revealStyle(index: number): CSSProperties {
  return { "--mk-i": Math.max(0, Math.floor(index)) } as CSSProperties;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
