"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/client/api";

/** A button that calls the API, shows the server's error message, then refreshes the page data. */
export function ApiButton({
  path, method = "POST", body, confirm, children, className = "btn sm", onDone, then,
}: {
  path: string;
  method?: string;
  body?: unknown;
  confirm?: string;
  children: ReactNode;
  className?: string;
  onDone?: (data: unknown) => void;
  then?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          try {
            const data = await api(path, { method, body });
            onDone?.(data);
            if (then) router.push(then);
            else router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : children}
      </button>
      {error && <span className="tiny" style={{ color: "var(--bad)", maxWidth: 320 }} role="alert">{error}</span>}
    </span>
  );
}

/** Polls router.refresh() while `active` (live job / evaluation progress). */
export function AutoRefresh({ active, ms = 3000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const h = setInterval(() => router.refresh(), ms);
    return () => clearInterval(h);
  }, [active, ms, router]);
  return null;
}
