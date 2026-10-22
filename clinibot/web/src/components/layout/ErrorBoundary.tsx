import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this value clears the error (pass location.pathname). */
  resetKey?: unknown;
  /** Fill the whole screen (root boundary) or just the content area. */
  fullPage?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
}

/**
 * A lazy page's file failed to load, usually because a deploy replaced it.
 * React.lazy keeps the rejected import, so only a page reload (which fetches
 * the new index.html and file names) recovers.
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
      error.message ?? "",
    )
  );
}

/**
 * Catches render errors (and failed lazy-chunk loads after a deploy) so one
 * broken page never blanks the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          fullPage={this.props.fullPage ?? false}
          // Rendering a failed lazy page again only fails again: offer the reload alone.
          onRetry={
            isChunkLoadError(this.state.error) ? undefined : () => this.setState({ error: null })
          }
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({
  fullPage,
  onRetry,
}: {
  fullPage: boolean;
  onRetry: (() => void) | undefined;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={
        fullPage
          ? "flex min-h-dvh flex-col items-center justify-center px-6 text-center"
          : "flex flex-col items-center px-6 py-16 text-center"
      }
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-extrabold text-slate-900">{t("common.errorBoundaryTitle")}</h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
        {t("common.errorBoundaryText")}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => window.location.reload()}
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
        >
          {t("common.reload")}
        </Button>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )}
      </div>
    </div>
  );
}
