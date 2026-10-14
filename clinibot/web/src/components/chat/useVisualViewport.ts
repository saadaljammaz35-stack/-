import { useEffect, useState } from "react";

export interface ViewportBox {
  /** Visible height in CSS pixels (shrinks when the on-screen keyboard opens). */
  height: number;
  /** How far iOS scrolled the layout viewport to keep the focused field visible. */
  offsetTop: number;
  /** A large part of the screen is covered (on-screen keyboard). */
  keyboardOpen: boolean;
}

/** Height lost to browser chrome is small; a keyboard takes far more than this. */
const KEYBOARD_THRESHOLD_PX = 120;

export function viewportBox(
  viewport: Pick<VisualViewport, "height" | "offsetTop" | "scale">,
  windowHeight: number,
): ViewportBox | null {
  // While the visitor pinch-zooms, follow the normal page layout instead.
  if (Math.abs(viewport.scale - 1) > 0.01) return null;
  const height = Math.round(viewport.height);
  return {
    height,
    offsetTop: Math.max(0, Math.round(viewport.offsetTop)),
    keyboardOpen: windowHeight - height > KEYBOARD_THRESHOLD_PX,
  };
}

function sameBox(a: ViewportBox | null, b: ViewportBox | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.height === b.height &&
      a.offsetTop === b.offsetTop &&
      a.keyboardOpen === b.keyboardOpen)
  );
}

/**
 * Tracks window.visualViewport so a full-height layout can sit exactly in the
 * visible area: on iPhone Safari the on-screen keyboard does not shrink 100dvh,
 * it covers it. Returns null where the API is missing (the layout then falls
 * back to 100dvh).
 */
export function useVisualViewport(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!viewport) return;
        const next = viewportBox(viewport, window.innerHeight);
        setBox((previous) => (sameBox(previous, next) ? previous : next));
      });
    }
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}
