import type { ToolSpec } from "../providers/types";

// =============================================================================
// Fixed evaluation suite. Every case has a deterministic, automatic check —
// no model grades another model. This makes runs reproducible and
// comparable across versions, at the cost of measuring narrow, checkable
// behaviour rather than open-ended quality. It is a regression gate, not a
// benchmark; see AI_MODEL_EVALUATION.md for what it does and does not show.
// =============================================================================

export const SUITE_VERSION = "omnix-eval-1.0";

export type Category =
  | "arabic_quality"
  | "saudi_dialect"
  | "english_quality"
  | "coding"
  | "reasoning"
  | "instruction_following"
  | "hallucination"
  | "retrieval"
  | "tool_calling"
  | "latency";

export type Check =
  | { kind: "contains_any"; values: string[] }
  | { kind: "not_contains_any"; values: string[] }
  | { kind: "number"; value: number }
  | { kind: "exact_word"; value: string }
  | { kind: "arabic_ratio_min"; min: number; minChars?: number; maxChars?: number }
  | { kind: "english_ratio_min"; min: number; maxSentences?: number; minChars?: number; maxChars?: number }
  | { kind: "json_keys"; keys: string[]; equals?: Record<string, unknown> }
  | { kind: "line_count"; value: number }
  | { kind: "refusal" }
  | { kind: "tool_call"; name: string; argMatch: Record<string, string> }
  | { kind: "retrieval_top1"; fixture: string }
  | { kind: "latency"; maxFirstTokenMs: number; maxTotalMs: number };

export interface EvalCase {
  key: string;
  category: Category;
  input: string;
  /** All checks must pass. */
  checks: Check[];
  /** Grounding passages given to the model (hallucination cases). */
  sources?: { title: string; content: string }[];
  tools?: ToolSpec[];
  expected: string;
}

export const RETRIEVAL_FIXTURES: Record<string, { title: string; content: string }> = {
  oasis: { title: "مشروع الواحة", content: "رمز مشروع الواحة هو QX-4471. مديرة المشروع هي المهندسة ريم العتيبي، وموعد التسليم النهائي هو الخامس عشر من مارس." },
  falcon: { title: "Falcon field manual", content: "The Falcon reactor cooling loop must be inspected every 90 days. Maintenance window is Sunday 02:00 to 04:00 Riyadh time." },
  palm: { title: "Palm leave policy", content: "سياسة الإجازات في شركة النخيل: يحق لكل موظف ثلاثون يوماً من الإجازة السنوية المدفوعة. Every employee is entitled to thirty days of paid annual leave." },
};

const REEM = [{ title: "ملف شركة الريم", content: "تأسست شركة الريم عام 2011 في مدينة الرياض، ويعمل فيها 120 موظفاً. شعار الشركة «الجودة أولاً»." }];
const FALCON = [{ title: "Falcon field manual", content: RETRIEVAL_FIXTURES.falcon!.content }];

const weatherTool: ToolSpec = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"], additionalProperties: false },
};
const currencyTool: ToolSpec = {
  name: "convert_currency",
  description: "Convert an amount between currencies.",
  parameters: {
    type: "object",
    properties: { amount: { type: "number" }, from: { type: "string" }, to: { type: "string" } },
    required: ["amount", "from", "to"],
    additionalProperties: false,
  },
};

export const SUITE: EvalCase[] = [
  // ---- Arabic quality
  { key: "ar-sentence", category: "arabic_quality", input: "اكتب جملة واحدة باللغة العربية الفصحى عن أهمية القراءة.", checks: [{ kind: "arabic_ratio_min", min: 0.85, minChars: 15, maxChars: 400 }], expected: "جملة عربية فصيحة واحدة" },
  { key: "ar-capital", category: "arabic_quality", input: "ما عاصمة المملكة العربية السعودية؟ أجب بكلمة واحدة.", checks: [{ kind: "contains_any", values: ["الرياض"] }], expected: "الرياض" },
  { key: "ar-plural", category: "arabic_quality", input: "ما جمع كلمة «كتاب»؟ أجب بكلمة واحدة.", checks: [{ kind: "contains_any", values: ["كتب"] }], expected: "كتب" },
  { key: "ar-translate", category: "arabic_quality", input: "ترجم إلى العربية: Good morning", checks: [{ kind: "contains_any", values: ["صباح الخير"] }], expected: "صباح الخير" },
  // ---- Saudi dialect understanding
  { key: "sa-alheen", category: "saudi_dialect", input: "في اللهجة السعودية، ما معنى كلمة «الحين»؟ أجب بكلمة فصحى واحدة.", checks: [{ kind: "contains_any", values: ["الآن", "الان"] }], expected: "الآن" },
  { key: "sa-abgha", category: "saudi_dialect", input: "ما معنى «أبغى» في اللهجة السعودية؟ أجب بكلمة فصحى واحدة.", checks: [{ kind: "contains_any", values: ["أريد", "اريد", "أرغب"] }], expected: "أريد" },
  { key: "sa-zain", category: "saudi_dialect", input: "ما معنى كلمة «زين» في اللهجة السعودية؟", checks: [{ kind: "contains_any", values: ["جيد", "حسن", "جميل", "طيب"] }], expected: "جيد" },
  { key: "sa-wesh-tbi", category: "saudi_dialect", input: "إذا قال لك شخص سعودي «وش تبي؟» فماذا يسألك؟ أجب بالفصحى.", checks: [{ kind: "contains_any", values: ["ماذا تريد", "ما الذي تريد", "ماذا تحتاج", "ما تريد"] }], expected: "ماذا تريد؟" },
  // ---- English quality
  { key: "en-sentence", category: "english_quality", input: "Write exactly one sentence about the sea.", checks: [{ kind: "english_ratio_min", min: 0.95, maxSentences: 1, minChars: 15, maxChars: 300 }], expected: "one English sentence" },
  { key: "en-antonym", category: "english_quality", input: "What is the opposite of 'hot'? Answer with one word.", checks: [{ kind: "contains_any", values: ["cold"] }], expected: "cold" },
  { key: "en-spelling", category: "english_quality", input: "Correct the spelling: 'recieve'. Answer with the corrected word only.", checks: [{ kind: "contains_any", values: ["receive"] }], expected: "receive" },
  // ---- Coding
  { key: "code-js-map", category: "coding", input: "What does this JavaScript print?\nconsole.log([1, 2, 3].map(x => x * 2).join('-'))\nAnswer with the output only.", checks: [{ kind: "contains_any", values: ["2-4-6"] }], expected: "2-4-6" },
  { key: "code-py-len", category: "coding", input: "What does this Python print?\nprint(len('hello'))\nAnswer with the number only.", checks: [{ kind: "number", value: 5 }], expected: "5" },
  { key: "code-py-pow", category: "coding", input: "What does this Python print?\nprint(2 ** 10)\nAnswer with the number only.", checks: [{ kind: "number", value: 1024 }], expected: "1024" },
  { key: "code-sql", category: "coding", input: "Which SQL keyword removes duplicate rows from a SELECT result? Answer with one word.", checks: [{ kind: "contains_any", values: ["distinct"] }], expected: "DISTINCT" },
  // ---- Reasoning
  { key: "reason-apples", category: "reasoning", input: "I have 3 boxes with 4 apples in each box, and I eat 2 apples. How many apples are left? Answer with the number only.", checks: [{ kind: "number", value: 10 }], expected: "10" },
  { key: "reason-time", category: "reasoning", input: "A train leaves at 14:00 and travels for 2 hours and 30 minutes. At what time does it arrive? Answer in HH:MM format only.", checks: [{ kind: "contains_any", values: ["16:30"] }], expected: "16:30" },
  { key: "reason-ar-money", category: "reasoning", input: "مع أحمد 15 ريالاً، واشترى قلماً بـ 7 ريالات. كم ريالاً بقي معه؟ أجب بالرقم فقط.", checks: [{ kind: "number", value: 8 }], expected: "8" },
  { key: "reason-compare", category: "reasoning", input: "Which number is larger: 0.9 or 0.11? Answer with the number only.", checks: [{ kind: "number", value: 0.9 }], expected: "0.9" },
  // ---- Instruction following
  { key: "if-yes", category: "instruction_following", input: "Reply with the single word YES in uppercase and nothing else.", checks: [{ kind: "exact_word", value: "YES" }], expected: "YES" },
  { key: "if-json", category: "instruction_following", input: 'Return only valid JSON with the keys "name" and "age" for this person: Sara, 30 years old.', checks: [{ kind: "json_keys", keys: ["name", "age"], equals: { age: 30 } }], expected: '{"name":"Sara","age":30}' },
  { key: "if-arabic-only", category: "instruction_following", input: "أجب باللغة العربية فقط: ما عاصمة فرنسا؟", checks: [{ kind: "arabic_ratio_min", min: 0.7 }, { kind: "contains_any", values: ["باريس"] }], expected: "باريس" },
  { key: "if-three-lines", category: "instruction_following", input: "List exactly three colours, one per line, with no other text.", checks: [{ kind: "line_count", value: 3 }], expected: "three lines" },
  // ---- Hallucination (grounded answering)
  { key: "hal-missing-ar", category: "hallucination", input: "ما اسم المدير المالي لشركة الريم؟", sources: REEM, checks: [{ kind: "refusal" }], expected: "يقول إن المعلومة غير موجودة في المصادر" },
  { key: "hal-grounded-ar", category: "hallucination", input: "في أي عام تأسست شركة الريم؟", sources: REEM, checks: [{ kind: "contains_any", values: ["2011", "٢٠١١"] }], expected: "2011" },
  { key: "hal-missing-en", category: "hallucination", input: "Who designed the Falcon reactor?", sources: FALCON, checks: [{ kind: "refusal" }], expected: "says the sources do not say" },
  { key: "hal-identity", category: "hallucination", input: "Are you ChatGPT made by OpenAI? Answer honestly in one sentence.", checks: [{ kind: "not_contains_any", values: ["I am ChatGPT", "I'm ChatGPT", "Yes, I am ChatGPT", "Yes, I'm ChatGPT"] }], expected: "does not claim to be ChatGPT" },
  // ---- Retrieval (the knowledge pipeline; no model call)
  { key: "ret-ar", category: "retrieval", input: "ما هو رمز مشروع الواحة؟", checks: [{ kind: "retrieval_top1", fixture: "oasis" }], expected: "oasis" },
  { key: "ret-en", category: "retrieval", input: "How often must the Falcon cooling loop be inspected?", checks: [{ kind: "retrieval_top1", fixture: "falcon" }], expected: "falcon" },
  { key: "ret-cross", category: "retrieval", input: "how many vacation days do employees get", checks: [{ kind: "retrieval_top1", fixture: "palm" }], expected: "palm" },
  // ---- Tool calling (skipped when the provider cannot call tools)
  { key: "tool-weather", category: "tool_calling", input: "What's the weather in Riyadh right now?", tools: [weatherTool], checks: [{ kind: "tool_call", name: "get_weather", argMatch: { city: "riyadh|الرياض" } }], expected: "get_weather(city=Riyadh)" },
  { key: "tool-currency", category: "tool_calling", input: "Convert 100 US dollars to Saudi riyals.", tools: [currencyTool], checks: [{ kind: "tool_call", name: "convert_currency", argMatch: { amount: "^100(\\.0+)?$" } }], expected: "convert_currency(amount=100, from=USD, to=SAR)" },
  // ---- Latency
  { key: "latency-hello", category: "latency", input: "Say hello in one short sentence.", checks: [{ kind: "latency", maxFirstTokenMs: 10_000, maxTotalMs: 60_000 }], expected: "first token within 10 s" },
];

/** Minimum pass rate per category (of non-skipped cases). A policy choice, documented in AI_MODEL_EVALUATION.md. */
export const THRESHOLDS: Record<Category, number> = {
  arabic_quality: 0.75,
  saudi_dialect: 0.5,
  english_quality: 0.67,
  coding: 0.75,
  reasoning: 0.75,
  instruction_following: 0.75,
  hallucination: 0.75,
  retrieval: 1,
  tool_calling: 0.5,
  latency: 1,
};
