'use client';

/** Current year, computed in the visitor's browser so it never goes stale. */
export function Year() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
