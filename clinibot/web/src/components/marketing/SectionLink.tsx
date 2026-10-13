import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { useOnHome } from "./context";
import { useReducedMotion } from "./motion";
import { scrollToSection } from "./sections";

interface SectionLinkProps {
  /** Section id on the landing page, e.g. "pricing". */
  to: string;
  className?: string;
  children: ReactNode;
  /** Called before scrolling (e.g. to close the mobile menu); scrolling then waits a tick. */
  onNavigate?: () => void;
  "aria-current"?: "true" | undefined;
}

/**
 * Link to a landing-page section. On the landing page it scrolls (smoothly
 * unless motion is reduced) and moves focus to the section heading; elsewhere
 * it navigates to "/#section".
 */
export function SectionLink({ to, className, children, onNavigate, ...rest }: SectionLinkProps) {
  const onHome = useOnHome();
  const reduced = useReducedMotion();

  if (!onHome) {
    return (
      <Link
        to={{ pathname: "/", hash: `#${to}` }}
        className={className}
        onClick={onNavigate}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!document.getElementById(to)) return;
    event.preventDefault();
    if (onNavigate) {
      onNavigate();
      // Let a closing menu return focus first, then move it to the section.
      window.setTimeout(() => scrollToSection(to, { reduced }), 0);
    } else {
      scrollToSection(to, { reduced });
    }
  }

  return (
    <a href={`#${to}`} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
