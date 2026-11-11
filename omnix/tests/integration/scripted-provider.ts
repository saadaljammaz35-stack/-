import { SUITE } from "@/lib/ai/eval/suite";
import type { GenerateRequest, GenerateResult, ModelProvider, StreamEvent } from "@/lib/ai/providers/types";

/**
 * TEST DOUBLE. Answers the evaluation suite correctly by construction so the
 * deploy gate's *success* path (pass → deploy → API access → rollback) can be
 * tested. It says nothing about any real model's quality; real-model results
 * come from the local Qwen run in evaluation.test.ts.
 */
const ANSWERS: Record<string, string> = {
  "ar-sentence": "القراءة تنير العقل وتوسع آفاق الإنسان.",
  "ar-capital": "الرياض",
  "ar-plural": "كتب",
  "ar-translate": "صباح الخير",
  "sa-alheen": "الآن",
  "sa-abgha": "أريد",
  "sa-zain": "جيد",
  "sa-wesh-tbi": "يسألك: ماذا تريد؟",
  "en-sentence": "The sea is calm and endless at dawn.",
  "en-antonym": "cold",
  "en-spelling": "receive",
  "code-js-map": "2-4-6",
  "code-py-len": "5",
  "code-py-pow": "1024",
  "code-sql": "DISTINCT",
  "reason-apples": "10",
  "reason-time": "16:30",
  "reason-ar-money": "8",
  "reason-compare": "0.9",
  "if-yes": "YES",
  "if-json": '{"name":"Sara","age":30}',
  "if-arabic-only": "عاصمة فرنسا هي باريس.",
  "if-three-lines": "red\ngreen\nblue",
  "hal-missing-ar": "لم أجد هذه المعلومة في المصادر المتاحة.",
  "hal-grounded-ar": "تأسست شركة الريم عام 2011 [S1].",
  "hal-missing-en": "The sources do not say who designed it; I couldn't find this.",
  "hal-identity": "No. I am a private OMNIX model, not ChatGPT.",
  "latency-hello": "Hello!",
};
const TOOLS: Record<string, { name: string; arguments: string }> = {
  "tool-weather": { name: "get_weather", arguments: '{"city":"Riyadh"}' },
  "tool-currency": { name: "convert_currency", arguments: '{"amount":100,"from":"USD","to":"SAR"}' },
};

export class ScriptedProvider implements ModelProvider {
  readonly type = "openai_compatible" as const;
  readonly name = "scripted-test-double";
  calls = 0;

  private answer(req: GenerateRequest): { text: string; tool?: { name: string; arguments: string } } {
    const user = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const c = SUITE.find((x) => x.input === user);
    if (c && TOOLS[c.key]) return { text: "", tool: TOOLS[c.key] };
    return { text: c ? (ANSWERS[c.key] ?? "") : "Hello from the scripted test provider." };
  }

  async *stream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    this.calls++;
    const a = this.answer(req);
    if (a.text) yield { type: "delta", text: a.text };
    const toolCalls = a.tool ? [{ id: "call_1", ...a.tool }] : [];
    for (const call of toolCalls) yield { type: "tool_call", call };
    yield {
      type: "done",
      result: {
        text: a.text,
        toolCalls,
        finishReason: toolCalls.length ? "tool_calls" : "stop",
        usage: { inputTokens: 10, outputTokens: 5, source: "provider" },
        model: req.model,
        latencyMs: 1,
        firstTokenMs: 1,
      },
    };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    let last: GenerateResult | null = null;
    for await (const ev of this.stream(req)) if (ev.type === "done") last = ev.result;
    return last!;
  }
  async healthCheck() {
    return { status: "healthy" as const, latencyMs: 1 };
  }
  async getCapabilities() {
    return { streaming: true, toolCalling: true, vision: false, embeddings: false, loadUnload: false, loraAdapters: false };
  }
  async getModelInfo(model: string) {
    return { id: model, contextLength: 8192 };
  }
  async listModels() {
    return [{ id: "scripted", contextLength: 8192 }];
  }
  async loadModel() {}
  async unloadModel() {}
}
