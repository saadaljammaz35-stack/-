import { use } from "react";
import { LogIn, RotateCcw } from "lucide-react";
import { AuthContext } from "@/auth/context";
import { useI18n } from "@/i18n";
import { describeError, errorReference, errorText } from "@/lib/errors";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export interface QueryErrorProps {
  error: unknown;
  /** Usually `() => void query.refetch()`. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/**
 * Standard error block for a failed query or request:
 *   if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
 */
export function QueryError({ error, onRetry, retrying = false, className }: QueryErrorProps) {
  const { t, tRich } = useI18n();
  // Null on public pages (no AuthProvider), which never need a session.
  const auth = use(AuthContext);
  const reference = errorReference(error);
  const { code } = describeError(error);
  // Signing out leads to /login?next=<this page>.
  const sessionEnded = auth !== null && (code === "unauthorized" || code === "session_expired");
  return (
    <Alert
      tone="error"
      title={t("errors.title")}
      className={className}
      action={
        // A 401 here can be a passing Auth hiccup between the function and
        // Supabase Auth while the session is fine, so Retry stays; when the
        // session really ended, AuthProvider signs out and redirects anyway.
        (onRetry || sessionEnded) && (
          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                loading={retrying}
                icon={<RotateCcw className="size-4" aria-hidden="true" />}
              >
                {t("common.retry")}
              </Button>
            )}
            {sessionEnded && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void auth.signOut()}
                icon={<LogIn className="flip-rtl size-4" aria-hidden="true" />}
              >
                {t("common.signInAgain")}
              </Button>
            )}
          </div>
        )
      }
    >
      <p>{errorText(t, error)}</p>
      {reference && (
        <p className="mt-1 text-xs opacity-80">
          {tRich("errors.reference", {
            id: (
              <span dir="ltr" className="font-mono select-all">
                {reference}
              </span>
            ),
          })}
        </p>
      )}
    </Alert>
  );
}
