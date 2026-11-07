/**
 * The «نقطة البيان» mark: a camera viewfinder framing the dotless body of ب
 * (from مُبيّن) as a scan tray, with its dot as the amber evidence point.
 * Same geometry as public/brand/mubayn-mark.svg (64-unit grid).
 */
export function LogoMark({ className = "logo-mark", tone = "ink" }: { className?: string; tone?: "ink" | "paper" }) {
  const bg = tone === "ink" ? "#121A24" : "#F3EFE6";
  const fg = tone === "ink" ? "#F3EFE6" : "#121A24";
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill={bg} />
      <path d="M11 22V11h11M42 11h11v11M11 42v11h11M42 53h11V42" fill="none" stroke={fg} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 27.5c0 7.6 3.6 10.5 9.2 10.5h7.6c5.6 0 9.2-2.9 9.2-10.5" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="46.5" r="4.4" fill="#F2A93B" />
    </svg>
  );
}

/** The same mark as an SVG string, for the PDF report. */
export const LOGO_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="28" height="28"><rect width="64" height="64" rx="15" fill="#121A24"/><path d="M11 22V11h11M42 11h11v11M11 42v11h11M42 53h11V42" fill="none" stroke="#F3EFE6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 27.5c0 7.6 3.6 10.5 9.2 10.5h7.6c5.6 0 9.2-2.9 9.2-10.5" fill="none" stroke="#F3EFE6" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="46.5" r="4.4" fill="#F2A93B"/></svg>';
