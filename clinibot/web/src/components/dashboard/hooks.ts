import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

function subscribeVisibility(callback: () => void): () => void {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

/** True while the browser tab is visible; polling stops while it is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

/** React Query `refetchInterval` that only polls while the tab is visible. */
export function usePollInterval(ms: number): number | false {
  return usePageVisible() ? ms : false;
}

/**
 * A search box whose value lives in the address (?q=). The box follows typing
 * at once; the trimmed text is committed `delay` ms after the last keystroke.
 * When the address changes from elsewhere (a link, the back button), the box
 * follows it instead of writing its old text back.
 */
export function useSearchDraft(
  value: string,
  commit: (next: string) => void,
  delay = 350,
): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (draft.trim() !== value) setDraft(value);
  }
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    const next = draft.trim();
    if (next === value) return;
    const timer = window.setTimeout(() => commitRef.current(next), delay);
    return () => window.clearTimeout(timer);
  }, [draft, value, delay]);
  return [draft, setDraft];
}

/** The current time, refreshed every `intervalMs` (for "5 minutes ago" and window countdowns). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The rendered width of an element, updated on resize (0 until measured). */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
