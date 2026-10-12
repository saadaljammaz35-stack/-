// Structured JSON logs. Patient data never reaches the logs: any field whose
// key looks like content or contact data is replaced before serialisation.

type Level = "info" | "warn" | "error";

const SENSITIVE_KEY =
  /^(body|text|content|message_text|reply|prompt|history|messages|phone|customer_phone|wa_id|customer_wa_id|from|to|email|customer_name|name|access_token|app_secret|token|verify_token|secret|password|authorization|apikey|api_key|session_token)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

function write(level: Level, event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: Record<string, unknown> = {}) => write("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => write("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => write("error", event, fields),
};
