import type { ToolCall } from "../providers/types";
import { arabicRatio, normalizeArabic } from "../text/arabic";
import type { Check } from "./suite";

export interface Observation {
  text: string;
  toolCalls: ToolCall[];
  firstTokenMs: number | null;
  totalMs: number;
  retrievedTop1?: string | null;
}

export interface CheckResult {
  passed: boolean;
  reason: string;
}

const norm = (s: string) => normalizeArabic(s).toLowerCase().replace(/\s+/g, " ").trim();

/** Strips reasoning blocks some models emit before the answer (e.g. <think>…</think>). */
export function answerText(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function firstNumber(text: string): number | null {
  const m = /-?\d+(?:\.\d+)?/.exec(normalizeArabic(text).replace(/[٫]/g, ".").replace(/,(?=\d{3}\b)/g, ""));
  return m ? Number(m[0]) : null;
}

const REFUSAL = [
  "not found", "couldn't find", "could not find", "can't find", "cannot find", "don't know", "do not know", "not mentioned",
  "no information", "not provided", "not specified", "does not say", "doesn't say", "not in the", "isn't in the", "not available",
  "لم اجد", "لا اجد", "لا توجد", "لا يوجد", "غير متوفر", "غير موجود", "لم يذكر", "لم تذكر", "لا تحتوي", "لا يحتوي", "لا اعرف", "لا اعلم",
  "ليس لدي", "غير مذكور", "لم ترد", "لا تتضمن",
];

function jsonFrom(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function runCheck(check: Check, o: Observation): CheckResult {
  const text = answerText(o.text);
  switch (check.kind) {
    case "contains_any": {
      const t = norm(text);
      const hit = check.values.find((v) => t.includes(norm(v)));
      return { passed: Boolean(hit), reason: hit ? `contains "${hit}"` : `none of ${JSON.stringify(check.values)} found` };
    }
    case "not_contains_any": {
      const t = norm(text);
      const hit = check.values.find((v) => t.includes(norm(v)));
      return { passed: !hit, reason: hit ? `contains forbidden "${hit}"` : "no forbidden phrase" };
    }
    case "number": {
      const n = firstNumber(text);
      return { passed: n !== null && Math.abs(n - check.value) < 1e-9, reason: `first number ${n ?? "none"}, expected ${check.value}` };
    }
    case "exact_word": {
      const t = text.replace(/[.!?"'`*]/g, "").trim();
      return { passed: t === check.value, reason: `got "${t.slice(0, 40)}"` };
    }
    case "arabic_ratio_min": {
      const r = arabicRatio(text);
      const len = text.length;
      const okLen = (check.minChars === undefined || len >= check.minChars) && (check.maxChars === undefined || len <= check.maxChars);
      return { passed: r >= check.min && okLen, reason: `arabic ratio ${r.toFixed(2)} (min ${check.min}), ${len} chars` };
    }
    case "english_ratio_min": {
      const r = 1 - arabicRatio(text);
      const sentences = (text.match(/[.!?](\s|$)/g) ?? []).length || (text.trim() ? 1 : 0);
      const len = text.length;
      const ok =
        r >= check.min &&
        (check.maxSentences === undefined || sentences <= check.maxSentences) &&
        (check.minChars === undefined || len >= check.minChars) &&
        (check.maxChars === undefined || len <= check.maxChars);
      return { passed: ok, reason: `latin ratio ${r.toFixed(2)}, ${sentences} sentence(s), ${len} chars` };
    }
    case "json_keys": {
      const v = jsonFrom(text) as Record<string, unknown> | undefined;
      if (!v || typeof v !== "object") return { passed: false, reason: "no valid JSON object" };
      const missing = check.keys.filter((k) => !(k in v));
      const wrong = Object.entries(check.equals ?? {}).filter(([k, val]) => v[k] !== val && String(v[k]) !== String(val));
      return { passed: !missing.length && !wrong.length, reason: missing.length ? `missing ${missing.join(",")}` : wrong.length ? `wrong ${wrong.map(([k]) => k).join(",")}` : "ok" };
    }
    case "line_count": {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return { passed: lines.length === check.value, reason: `${lines.length} non-empty lines` };
    }
    case "refusal": {
      const t = norm(text);
      const hit = REFUSAL.find((p) => t.includes(norm(p)));
      return { passed: Boolean(hit), reason: hit ? `declines: "${hit}"` : "answered without saying the sources lack it" };
    }
    case "tool_call": {
      const call = o.toolCalls.find((c) => c.name === check.name);
      if (!call) return { passed: false, reason: `no ${check.name} call (calls: ${o.toolCalls.map((c) => c.name).join(",") || "none"})` };
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        return { passed: false, reason: "arguments are not valid JSON" };
      }
      const bad = Object.entries(check.argMatch).filter(([k, re]) => !new RegExp(re, "i").test(String(args[k] ?? "")));
      return { passed: !bad.length, reason: bad.length ? `argument mismatch: ${bad.map(([k]) => k).join(",")}` : "ok" };
    }
    case "retrieval_top1":
      return { passed: o.retrievedTop1 === check.fixture, reason: `top result: ${o.retrievedTop1 ?? "none"}` };
    case "latency": {
      const ok = o.firstTokenMs !== null && o.firstTokenMs <= check.maxFirstTokenMs && o.totalMs <= check.maxTotalMs;
      return { passed: ok, reason: `first token ${o.firstTokenMs ?? "n/a"} ms, total ${o.totalMs} ms` };
    }
  }
}

export function scoreCase(checks: Check[], o: Observation): CheckResult {
  const results = checks.map((c) => runCheck(c, o));
  return { passed: results.every((r) => r.passed), reason: results.map((r) => r.reason).join("; ") };
}
