import { describe, expect, it } from "vitest";
import { runCheck, scoreCase } from "@/lib/ai/eval/scorers";
import { SUITE, THRESHOLDS } from "@/lib/ai/eval/suite";
import { assignSplit, itemHash, parseDatasetFile, snapshotHash, structuralErrors } from "@/lib/ai/training/datasets";

const o = (text: string, extra: object = {}) => ({ text, toolCalls: [], firstTokenMs: 100, totalMs: 500, ...extra });

describe("evaluation scorers", () => {
  it("normalises Arabic before matching", () => {
    expect(runCheck({ kind: "contains_any", values: ["الآن"] }, o("المعنى: الان")).passed).toBe(true);
  });
  it("extracts numbers, including Arabic-Indic digits", () => {
    expect(runCheck({ kind: "number", value: 8 }, o("بقي معه ٨ ريالات")).passed).toBe(true);
    expect(runCheck({ kind: "number", value: 10 }, o("1")).passed).toBe(false);
  });
  it("checks JSON keys and values, including fenced JSON", () => {
    expect(runCheck({ kind: "json_keys", keys: ["name", "age"], equals: { age: 30 } }, o('```json\n{"name":"Sara","age":30}\n```')).passed).toBe(true);
    expect(runCheck({ kind: "json_keys", keys: ["name", "age"] }, o("Sara is 30")).passed).toBe(false);
  });
  it("recognises refusals in both languages and ignores <think> blocks", () => {
    expect(runCheck({ kind: "refusal" }, o("لم أجد هذه المعلومة في المصادر")).passed).toBe(true);
    expect(runCheck({ kind: "refusal" }, o("<think>not found</think>It was designed by Dr. X.")).passed).toBe(false);
  });
  it("validates tool calls by name and arguments", () => {
    const call = { id: "1", name: "get_weather", arguments: '{"city":"Riyadh"}' };
    expect(runCheck({ kind: "tool_call", name: "get_weather", argMatch: { city: "riyadh" } }, o("", { toolCalls: [call] })).passed).toBe(true);
    expect(runCheck({ kind: "tool_call", name: "get_weather", argMatch: { city: "jeddah" } }, o("", { toolCalls: [call] })).passed).toBe(false);
  });
  it("requires all checks of a case", () => {
    expect(scoreCase([{ kind: "arabic_ratio_min", min: 0.7 }, { kind: "contains_any", values: ["باريس"] }], o("Paris")).passed).toBe(false);
  });
  it("has unique case keys and a threshold for every category", () => {
    expect(new Set(SUITE.map((c) => c.key)).size).toBe(SUITE.length);
    for (const c of SUITE) expect(THRESHOLDS[c.category]).toBeGreaterThan(0);
  });
});

describe("dataset logic", () => {
  it("accepts well-formed chat records and explains malformed ones", () => {
    expect(structuralErrors({ messages: [{ role: "system", content: "s" }, { role: "user", content: "q" }, { role: "assistant", content: "a" }] })).toEqual([]);
    expect(structuralErrors({ messages: [{ role: "user", content: "q" }] }).join()).toMatch(/at least/);
    expect(structuralErrors({ messages: [{ role: "user", content: "q" }, { role: "user", content: "q" }] }).join()).toMatch(/expected assistant/);
  });
  it("parses messages, prompt/completion and instruction formats", () => {
    const text = [
      '{"messages":[{"role":"user","content":"a"},{"role":"assistant","content":"b"}]}',
      '{"prompt":"p","completion":"c"}',
      '{"instruction":"i","input":"x","output":"o"}',
      "garbage",
    ].join("\n");
    const r = parseDatasetFile(text);
    expect(r.records).toHaveLength(3);
    expect(r.records[2]!.messages[0]!.content).toBe("i\n\nx");
    expect(r.errors).toEqual([{ line: 4, error: "invalid JSON" }]);
  });
  it("treats whitespace variants as duplicates", () => {
    const a = { messages: [{ role: "user" as const, content: "hello  world" }, { role: "assistant" as const, content: "hi" }] };
    const b = { messages: [{ role: "user" as const, content: " hello world " }, { role: "assistant" as const, content: "hi" }] };
    expect(itemHash(a)).toBe(itemHash(b));
  });
  it("splits deterministically and roughly 80/10/10", () => {
    const hashes = Array.from({ length: 2000 }, (_, i) => itemHash({ messages: [{ role: "user", content: `q${i}` }, { role: "assistant", content: "a" }] }));
    const counts = { train: 0, validation: 0, test: 0 };
    for (const h of hashes) counts[assignSplit(h, 2000)]++;
    expect(counts.train / 2000).toBeGreaterThan(0.75);
    expect(counts.test / 2000).toBeGreaterThan(0.07);
    expect(assignSplit(hashes[0]!, 2000)).toBe(assignSplit(hashes[0]!, 2000));
  });
  it("computes the same snapshot hash as the Python worker", () => {
    const items = [{ item_hash: "b".repeat(64), split: "validation" }, { item_hash: "a".repeat(64), split: "train" }, { item_hash: "c".repeat(64), split: "test" }];
    expect(snapshotHash(items)).toBe("528aa561140f927fa4fce0dcd9b1d3ee91dc14915f4a9675acb16c46d4f87274");
  });
});
