import { redact } from "@/lib/security/redact";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.OMNIX_LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
  return order[lvl] ?? 20;
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (order[level] < threshold()) return;
  if (process.env.NODE_ENV === "test" && level !== "error" && !process.env.OMNIX_TEST_LOGS) return;
  // Every log line passes through redaction: secrets, tokens and connection
  // strings never reach log storage, even if a caller passes them by mistake.
  const line = JSON.stringify(redact({ ts: new Date().toISOString(), level, event, ...fields }));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
