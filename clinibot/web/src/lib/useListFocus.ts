import { useCallback, useEffect, useRef, type RefObject } from "react";

type Pending = { kind: "removed"; id: string; index: number } | { kind: "added" };

/** Marks a list row: `<li {...listFocusRow(item.id)}>`. */
export function listFocusRow(id: string) {
  return { "data-focus-row": id };
}

/** Marks the control that takes focus in a row (e.g. its edit button). */
export const listFocusTarget = { "data-focus-target": "" } as const;

/**
 * Keeps keyboard focus on the page when a dialog's change removes the element
 * that opened it: a deleted row takes its buttons along, and the first item
 * added replaces the empty state (and its Add button) with the list. Without
 * this, focus falls to <body> and the next Tab starts from the top.
 *
 * Mark rows with `listFocusRow(id)` and each row's main control with
 * `listFocusTarget`. After a successful change call `removed(id, index)` or
 * `added()` (only when the list was empty), and pass `returnFocus` to the
 * dialog. Focus goes to the row now at that index (or the one before it), else
 * to `fallback()`. Whichever comes later does it: the dialog closing, or the
 * refetched list rendering.
 */
export function useListFocus({
  listRef,
  rows,
  fallback,
}: {
  /** The list element; null while the list is not rendered (empty state). */
  listRef: RefObject<HTMLElement | null>;
  /** The rendered rows; a change re-checks whether the target is on the page yet. */
  rows: readonly unknown[];
  /** When no row is left (e.g. the empty state's Add button, or the section heading). */
  fallback: () => HTMLElement | null;
}) {
  const pendingRef = useRef<Pending | null>(null);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });

  /** The element to focus once the change is on the page, else null (not yet, or nothing pending). */
  const returnFocus = useCallback((): HTMLElement | null => {
    const pending = pendingRef.current;
    if (!pending) return null;
    const list = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-focus-row]") ?? [],
    );
    if (pending.kind === "removed") {
      if (list.some((row) => row.dataset.focusRow === pending.id)) return null;
    } else if (list.length === 0) {
      return null;
    }
    pendingRef.current = null;
    const row =
      pending.kind === "removed"
        ? list[Math.min(Math.max(pending.index, 0), list.length - 1)]
        : list[0];
    return row?.querySelector<HTMLElement>("[data-focus-target]") ?? fallbackRef.current();
  }, [listRef]);

  // The list re-rendered after the dialog closed: focus fell to <body> with the removed element.
  useEffect(() => {
    if (!pendingRef.current) return;
    const active = document.activeElement;
    // Still in the dialog: it hands focus over through returnFocus when it closes.
    if (active?.closest('[aria-modal="true"]')) return;
    const target = returnFocus();
    if (target && (!active || active === document.body)) target.focus();
  }, [rows, returnFocus]);

  const removed = useCallback((id: string, index: number) => {
    pendingRef.current = { kind: "removed", id, index };
  }, []);
  const added = useCallback(() => {
    pendingRef.current = { kind: "added" };
  }, []);

  return { removed, added, returnFocus };
}
