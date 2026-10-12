import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { Anthropic } from "../deps.ts";
import { type AssistantConfig, classifyError, runAssistant, type ToolExecutor } from "./claude.ts";
import { FakeClaude, message, text, thinking, toolUse } from "./fakes.ts";
import { TOOL_DEFINITIONS } from "./tools.ts";

const config: AssistantConfig = { model: "claude-opus-5-5", effort: "low" };
const system = [{ type: "text" as const, text: "rules" }];

function recordingExecutor(results: Record<string, { ok: boolean }> = {}) {
  const calls: Array<{ name: string; input: unknown }> = [];
  const execute: ToolExecutor = (name, input) => {
    calls.push({ name, input });
    const ok = results[name]?.ok ?? true;
    return Promise.resolve({ result: ok ? { ok: true } : { ok: false, error: "nope" }, isError: !ok });
  };
  return { calls, execute };
}

function run(client: FakeClaude, execute: ToolExecutor) {
  return runAssistant({
    client,
    config,
    system,
    tools: TOOL_DEFINITIONS,
    messages: [{ role: "user", content: "مرحبا" }],
    executeTool: execute,
  });
}

Deno.test("request: adaptive thinking, effort, server-side fallback, auto tool choice, no sampling params", async () => {
  const client = new FakeClaude([message("end_turn", [text("أهلًا")])]);
  await run(client, recordingExecutor().execute);
  const params = client.calls[0]!;
  assertEquals(params.model, "claude-opus-5-5");
  assertEquals(params.max_tokens, 4096);
  assertEquals(params.betas, ["server-side-fallback-2026-07-01"]);
  assertEquals(params.fallbacks, "default");
  assertEquals(params.thinking, { type: "adaptive" });
  assertEquals(params.output_config, { effort: "low" });
  assertEquals(params.tool_choice, { type: "auto" });
  assertEquals(params.system, system);
  for (const banned of ["temperature", "top_p", "top_k"]) assert(!(banned in params), banned);
  for (const tool of params.tools ?? []) {
    const definition = tool as Anthropic.Beta.BetaTool;
    assertEquals(definition.strict, true);
    assertEquals(definition.input_schema.additionalProperties, false);
    assertEquals(
      [...(definition.input_schema.required ?? [])].sort(),
      Object.keys(definition.input_schema.properties as Record<string, unknown>).sort(),
    );
  }
});

Deno.test("tool loop: tool_use → results → end_turn, assistant content passed back unchanged", async () => {
  const toolTurn = message("tool_use", [
    thinking(),
    text("سأسجل طلبك."),
    toolUse("create_appointment_request", { customer_name: "Sara" }, "toolu_1"),
    toolUse("request_human_handoff", { reason: "booking_help", summary: "x" }, "toolu_2"),
  ], { input_tokens: 100, output_tokens: 30 });
  const finalTurn = message("end_turn", [thinking(), text("تم استلام طلبك.")], {
    input_tokens: 150,
    output_tokens: 10,
    cache_read_input_tokens: 80,
  });
  const client = new FakeClaude([toolTurn, finalTurn]);
  const executor = recordingExecutor({ request_human_handoff: { ok: false } });

  const result = await run(client, executor.execute);
  assert(result.ok && result.outcome === "answered");
  assertEquals(result.reply, "تم استلام طلبك.");
  assertEquals(result.apiCalls, 2);
  assertEquals(result.usage, {
    input_tokens: 250,
    output_tokens: 40,
    cache_read_input_tokens: 80,
    cache_creation_input_tokens: 0,
  });
  assertEquals(executor.calls.map((c) => c.name), ["create_appointment_request", "request_human_handoff"]);

  const second = client.calls[1]!.messages;
  assertEquals(second.length, 3);
  assertEquals(second[1], { role: "assistant", content: toolTurn.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
  assertEquals(second[2], {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify({ ok: true }) },
      { type: "tool_result", tool_use_id: "toolu_2", content: JSON.stringify({ ok: false, error: "nope" }), is_error: true },
    ],
  });
});

Deno.test("tool loop stops after three rounds", async () => {
  const loop = () => message("tool_use", [toolUse("request_human_handoff", { reason: "other", summary: "x" })]);
  const client = new FakeClaude([loop(), loop(), loop(), loop(), message("end_turn", [text("never")])]);
  const result = await run(client, recordingExecutor().execute);
  assert(!result.ok);
  assertEquals(result.failure.kind, "tool_rounds");
  assertEquals(client.calls.length, 4);
});

Deno.test("refusal is reported, not treated as text", async () => {
  const client = new FakeClaude([
    message("refusal", [text("partial")], {}, { stop_details: { type: "refusal", category: "bio", explanation: null } }),
  ]);
  const result = await run(client, recordingExecutor().execute);
  assert(result.ok && result.outcome === "refused");
  assertEquals(result.category, "bio");
  assertEquals(result.apiCalls, 1);
});

Deno.test("max_tokens is a failure, never a truncated reply", async () => {
  const client = new FakeClaude([message("max_tokens", [text("The price is")])]);
  const result = await run(client, recordingExecutor().execute);
  assert(!result.ok);
  assertEquals(result.failure.kind, "max_tokens");
  assertEquals(result.apiCalls, 1);
});

Deno.test("thinking and fallback blocks are ignored; the serving model is reported", async () => {
  const client = new FakeClaude([
    message("end_turn", [
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" }, trigger: {} },
      thinking(),
      text("Hello"),
      text(" there"),
    ], {}, { model: "claude-opus-5" }),
  ]);
  const result = await run(client, recordingExecutor().execute);
  assert(result.ok && result.outcome === "answered");
  assertEquals(result.reply, "Hello there");
  assertEquals(result.model, "claude-opus-5");
});

Deno.test("an empty reply (thinking only) is a failure", async () => {
  const client = new FakeClaude([message("end_turn", [thinking()])]);
  const result = await run(client, recordingExecutor().execute);
  assert(!result.ok);
  assertEquals(result.failure.kind, "empty_reply");
});

Deno.test("SDK errors become failures, classified most specific first", async () => {
  const headers = new Headers();
  const cases: Array<[Error, string, number | null]> = [
    [new Anthropic.AuthenticationError(401, { type: "error" }, "bad key", headers), "auth", 401],
    [new Anthropic.RateLimitError(429, { type: "error" }, "slow down", headers), "rate_limited", 429],
    [new Anthropic.InternalServerError(529, { type: "error" }, "overloaded", headers), "server", 529],
    [new Anthropic.BadRequestError(400, { type: "error" }, "bad", headers), "bad_request", 400],
    [new Anthropic.APIConnectionTimeoutError(), "timeout", null],
    [new Anthropic.APIConnectionError({ message: "reset" }), "connection", null],
    [new TypeError("bug"), "unknown", null],
  ];
  for (const [error, kind, status] of cases) {
    assertEquals(classifyError(error), { kind, status }, kind);
    const result = await run(new FakeClaude([error]), recordingExecutor().execute);
    assert(!result.ok);
    assertEquals(result.failure.kind, kind);
    assertEquals(result.apiCalls, 0);
  }
});
