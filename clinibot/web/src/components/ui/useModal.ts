import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true",
  );
}

/** Open modals, innermost last: only the top one reacts to Escape / Tab. */
const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll(): () => void {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

interface ModalOptions {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  /** When false, Escape does nothing (e.g. while a request is running). */
  dismissible?: boolean;
  /**
   * Where focus goes on close when the opener is gone (e.g. the deleted row's
   * button). Resolved after closing; falls back to the page's #main.
   */
  returnFocus?: (() => HTMLElement | null) | undefined;
}

/**
 * After a modal closes: when focus ended up on <body> (the opener was removed,
 * or never restored), focus the caller's target, else the page's #main. A
 * removed focused element leaves focus on <body>, so that one check covers it.
 */
function ensureFocus(fallback: () => HTMLElement | null) {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target = fallback();
    if (target?.isConnected) target.focus();
    else document.getElementById("main")?.focus({ preventScroll: true });
  });
}

/**
 * Keyboard behaviour shared by Dialog and Sheet: moves focus inside on open,
 * keeps Tab inside, closes on Escape, locks page scroll, and returns focus to
 * the element that opened it.
 */
export function useModal({
  open,
  onClose,
  panelRef,
  initialFocusRef,
  dismissible = true,
  returnFocus,
}: ModalOptions) {
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const returnFocusRef = useRef(returnFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
    returnFocusRef.current = returnFocus;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    stack.push(id);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();

    const panel = panelRef.current;
    const target = initialFocusRef?.current ?? (panel ? focusableWithin(panel)[0] : null) ?? panel;
    target?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") {
        // An open menu inside the panel (e.g. the clinic switcher in the phone menu) closes
        // itself first; the panel closes on the next Escape.
        if (
          event.target instanceof Element &&
          panel?.contains(event.target) &&
          event.target.closest('[role="menu"]')
        ) {
          return;
        }
        if (!dismissibleRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = focusableWithin(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      unlock();
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
      // The opener may be gone (a deleted row) or removed by the change this modal made.
      ensureFocus(() => returnFocusRef.current?.() ?? null);
    };
    // initialFocusRef / panelRef are refs: stable by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
