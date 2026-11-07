// TEST DOUBLE — NOT AI. A local stand-in for the Anthropic Messages API so the
// pipeline (evidence manifest, citation validation, retries, failure handling,
// report versioning, PDF) can be tested without spending money or needing a
// key. Production refuses ANTHROPIC_BASE_URL_OVERRIDE, so this can never serve
// real customers. Responses are clearly marked as test output.
//
//   node e2e/mock-anthropic.mts 3999
import http from "node:http";

type Mode = "ok" | "overloaded_once" | "invalid" | "refusal" | "auth" | "price_error";
let mode: Mode = "ok";
let overloadedServed = false;
const requests: { at: string; images: number; labels: string[] }[] = [];

function analysisFor(labels: string[], arabic: boolean) {
  const [a, b, c] = [labels[0] ?? "E1", labels[1] ?? labels[0] ?? "E1", labels[2] ?? labels[0] ?? "E1"];
  const T = (ar: string, en: string) => `[TEST OUTPUT] ${arabic ? ar : en}`;
  return {
    device_match: { matches_declared_device: "uncertain", observed_device: T("صور اختبار مُولّدة", "generated test images"), reasoning: T("هذه بيانات اختبار", "this is test data") },
    evidence_quality: { rating: "fair", issues: [T("صور اختبار", "test images")] },
    overall_condition: "fair",
    condition_score: 62,
    confidence: "low",
    summary: T("هذا رد اختباري من بديل محلي لواجهة Anthropic وليس تحليلاً حقيقياً.", "This is a test response from a local stand-in for the Anthropic API, not a real analysis."),
    findings: [
      { area: "screen", severity: "minor", title: T("ملاحظة اختبار 1", "Test finding 1"), detail: T("تفصيل", "detail"), confidence: "medium", evidence_refs: [a] },
      { area: "back", severity: "moderate", title: T("ملاحظة اختبار 2", "Test finding 2"), detail: T("تفصيل", "detail"), confidence: "low", evidence_refs: [b, c] },
      { area: "ports", severity: "major", title: T("ملاحظة تستشهد بدليل غير موجود", "Finding citing a non-existent label"), detail: "must be dropped", confidence: "high", evidence_refs: ["E999"] },
    ],
    seller_claims_check: [{ claim: T("بدون خدوش", "no scratches"), verdict: "contradicted", explanation: T("اختبار", "test"), evidence_refs: [a] }],
    areas_not_covered: [T("البطارية", "battery")],
    limitations: [T("صور اختبار", "test images")],
    recommended_checks: [T("افحص الشحن", "test charging")],
  };
}

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks).toString();
  const send = (status: number, obj: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", "request-id": `req_test_${Date.now()}`, ...headers });
    res.end(JSON.stringify(obj));
  };
  if (req.url === "/__mode" && req.method === "POST") {
    mode = JSON.parse(body).mode;
    overloadedServed = false;
    return send(200, { mode });
  }
  if (req.url === "/__requests") return send(200, requests);
  if (!req.url?.startsWith("/v1/messages")) return send(404, { type: "error", error: { type: "not_found_error", message: "not found" } });
  // SDK 1.x (API version 2026-10-21) sends the key as a Bearer token; older clients use x-api-key.
  const key = req.headers["x-api-key"] ?? (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (key !== "test-key-not-real") return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });

  const parsed = JSON.parse(body);

  // Price step: a request carrying the web_search server tool. Answer like the
  // real API would: a search, its results, then text ending in the JSON object,
  // citing one of the results. Clearly marked as test output.
  if ((parsed.tools ?? []).some((t: { name?: string }) => t.name === "web_search")) {
    if (mode === "auth") return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    if (mode === "price_error") return send(400, { type: "error", error: { type: "invalid_request_error", message: "test: price step failed" } });
    const ask = String(parsed.messages?.[0]?.content ?? "");
    const ar = /Arabic/.test(ask);
    const answer = {
      low: 1400, high: 1650, confidence: "medium",
      asking_price_verdict: /No asking price stated/.test(ask) ? "no_asking_price" : "high",
      basis: ar ? "[TEST OUTPUT] أسعار اختبار وليست من السوق." : "[TEST OUTPUT] Test prices, not from the market.",
    };
    return send(200, {
      id: `msg_test_${Date.now()}`, type: "message", role: "assistant", model: parsed.model, stop_sequence: null, stop_reason: "end_turn",
      usage: { input_tokens: 4000, output_tokens: 400, server_tool_use: { web_search_requests: 1 } },
      content: [
        { type: "server_tool_use", id: "srvtoolu_test1", name: "web_search", input: { query: "test used price" } },
        { type: "web_search_tool_result", tool_use_id: "srvtoolu_test1", content: [
          { type: "web_search_result", url: "https://example.test/listing-1", title: "[TEST] listing 1", encrypted_content: "x", page_age: null },
          { type: "web_search_result", url: "https://example.test/listing-2", title: "[TEST] listing 2", encrypted_content: "x", page_age: null },
        ] },
        { type: "text", text: JSON.stringify(answer), citations: [{ type: "web_search_result_location", url: "https://example.test/listing-1", title: "[TEST] listing 1", encrypted_index: "x", cited_text: "1500" }] },
      ],
    });
  }

  const content = parsed.messages?.[0]?.content ?? [];
  const images = content.filter((b: { type: string }) => b.type === "image").length;
  const text = content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
  const labels = (/Valid evidence labels: ([^.]+)\./.exec(text)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  requests.push({ at: new Date().toISOString(), images, labels });
  const arabic = /Report language: Arabic/.test(text);

  if (mode === "auth") return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
  if (mode === "overloaded_once" && !overloadedServed) {
    overloadedServed = true;
    // 529 is retried by the SDK itself first; send it enough times to exhaust SDK retries.
    return send(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, { "x-should-retry": "false" });
  }
  const base = { id: `msg_test_${Date.now()}`, type: "message", role: "assistant", model: parsed.model, stop_sequence: null, usage: { input_tokens: 1000 + images * 1500, output_tokens: 1800 } };
  if (mode === "refusal") return send(200, { ...base, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: "test" } });
  if (mode === "invalid") return send(200, { ...base, content: [{ type: "text", text: "{\"not\":\"the schema\"}" }], stop_reason: "end_turn" });
  return send(200, { ...base, content: [{ type: "text", text: JSON.stringify(analysisFor(labels, arabic)) }], stop_reason: "end_turn" });
});

server.listen(Number(process.argv[2] ?? 3999), () => console.log(`mock anthropic (TEST DOUBLE) on ${process.argv[2] ?? 3999}`));
