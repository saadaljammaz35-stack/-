import { useId } from "react";
import { cn } from "@/lib/cn";

export const BRAND = {
  navy: "#0F4C81",
  teal: "#10B981",
  mint: "#E6F7F3",
  background: "#F8FAFC",
} as const;

export interface LogoMarkProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** For dark (navy) backgrounds: lighter antenna and a subtle outline. */
  inverse?: boolean;
  className?: string;
  /** Accessible name. Pass "" when the mark sits next to the "CliniBot" wordmark. */
  title?: string;
}

/**
 * The CliniBot mark: a rounded speech bubble (tail at bottom-left) with a
 * navy→teal diagonal gradient, holding a white robot-face screen with two
 * eyes and a smile, and an antenna on top. Never mirrored in RTL.
 */
export function LogoMark({ size = 40, inverse = false, className, title = "CliniBot" }: LogoMarkProps) {
  // useId() can contain characters that are awkward inside url(#…); keep [A-Za-z0-9_-].
  const gradientId = `cb-grad-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const decorative = title === "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="10" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND.navy} />
          <stop offset="1" stopColor={BRAND.teal} />
        </linearGradient>
      </defs>
      {/* antenna */}
      <path
        d="M32 7v6"
        stroke={inverse ? "#FFFFFF" : BRAND.navy}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="5" r="4" fill={BRAND.teal} stroke={inverse ? "#FFFFFF" : "none"} strokeWidth="1.5" />
      {/* speech bubble with tail at the bottom-left */}
      <path
        d="M18 12H46A14 14 0 0 1 60 26V40A14 14 0 0 1 46 54H26L12.4 62.2C11.2 63.1 9 62.4 9 60.9V50.7A14 14 0 0 1 4 40V26A14 14 0 0 1 18 12Z"
        fill={`url(#${gradientId})`}
        stroke={inverse ? "rgba(255,255,255,0.35)" : "none"}
        strokeWidth="1.5"
      />
      {/* robot face screen */}
      <rect x="13" y="20.5" width="38" height="25" rx="9.5" fill="#FFFFFF" />
      <circle cx="24.5" cy="30.5" r="3.4" fill={BRAND.navy} />
      <circle cx="39.5" cy="30.5" r="3.4" fill={BRAND.navy} />
      <path
        d="M25.5 37.2q6.5 5 13 0"
        fill="none"
        stroke={BRAND.navy}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type LogoVariant = "mark" | "horizontal" | "inverse";

export interface LogoProps {
  /** "mark" (icon only), "horizontal" (mark + wordmark), "inverse" (horizontal, for navy backgrounds). */
  variant?: LogoVariant;
  /** Show the Arabic tagline "مساعدك الذكي في عيادتك" under the wordmark. */
  tagline?: boolean;
  /** Mark size in px; the wordmark scales with it. */
  size?: number;
  className?: string;
}

export function Logo({ variant = "horizontal", tagline = false, size = 36, className }: LogoProps) {
  if (variant === "mark") return <LogoMark size={size} className={className} />;
  const inverse = variant === "inverse";
  return (
    // The lockup keeps its Latin left-to-right order in both languages.
    <span dir="ltr" className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} inverse={inverse} title="" />
      <span className="flex flex-col leading-none">
        <span
          className="font-extrabold tracking-tight"
          style={{ fontSize: Math.round(size * 0.62) }}
          lang="en"
        >
          <span className={inverse ? "text-white" : "text-primary"}>Clini</span>
          <span className={inverse ? "text-emerald-300" : "text-accent"}>Bot</span>
        </span>
        {tagline && (
          <span
            dir="rtl"
            lang="ar"
            className={cn("mt-1 font-medium", inverse ? "text-white/75" : "text-slate-500")}
            style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}
          >
            مساعدك الذكي في عيادتك
          </span>
        )}
      </span>
    </span>
  );
}
