import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { settleDelay, useInView, useReducedMotion } from "./motion";

interface RevealProps {
  as?: ElementType;
  className?: string;
  /** Number of items inside marked with data-reveal; sets when delays retire. */
  items?: number;
  children: ReactNode;
  id?: string;
}

/**
 * Entrance group: children marked `data-reveal` (with revealStyle(i)) fade and
 * rise in a stagger the first time the group scrolls into view. After the
 * last one has entered, the delays are retired so hover effects never lag.
 * With reduced motion everything is shown immediately.
 */
export function Reveal({ as: Tag = "div", className, items = 1, children, id }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { rootMargin: "0px 0px -8% 0px", threshold: 0.08, once: true });
  const revealed = reduced || inView;
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!revealed || settled) return;
    const timer = window.setTimeout(() => setSettled(true), reduced ? 0 : settleDelay(items));
    return () => window.clearTimeout(timer);
  }, [revealed, settled, reduced, items]);

  return (
    <Tag
      ref={ref}
      id={id}
      className={className}
      data-reveal-group=""
      data-revealed={revealed ? "true" : "false"}
      data-settled={settled ? "true" : "false"}
    >
      {children}
    </Tag>
  );
}
