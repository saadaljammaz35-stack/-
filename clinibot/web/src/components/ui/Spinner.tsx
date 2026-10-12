import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
  /** Screen-reader text. Omit when the spinner sits next to visible text. */
  label?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "size-4", md: "size-5", lg: "size-8" } as const;

export function Spinner({ className, label, size = "md" }: SpinnerProps) {
  const svg = (
    <svg
      className={cn("animate-spin", SIZES[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
  if (!label) return svg;
  return (
    <span role="status" className="inline-flex">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
