import { Logo } from "@/components/brand/Logo";
import { QueryError } from "./QueryError";

/** A whole-screen error with retry (e.g. memberships failed to load). */
export function FullPageError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Logo />
      <QueryError error={error} onRetry={onRetry} className="w-full max-w-md" />
    </div>
  );
}
