// Base-model candidates. Every fact below was read from the Hugging Face Hub
// API (`/api/models/<id>`) and the model's config.json on 2026-11-10; see
// AI_MODEL_ARCHITECTURE.md §5. Quality is NOT recorded here: it comes only
// from evaluation runs stored in ai_evaluation_runs.

export interface BaseModelCandidate {
  id: string;
  license: string;
  commercialUse: "permitted" | "conditional";
  parameters: number;
  contextLength: number | null;
  arabicFirst: boolean;
  architecture: string;
  gated: boolean;
  /** Approximate VRAM to serve in bf16 (2 bytes/param + ~20% overhead). Derived, not measured. */
  servingVramGbBf16: number;
  /** Approximate VRAM for QLoRA fine-tuning (4-bit base + adapters + activations). Rule of thumb, not measured. */
  qloraVramGb: number;
  ollamaTag?: string;
  notes: string;
  role: "production_default" | "arabic_challenger" | "candidate" | "dev_ci";
}

const vram = (p: number) => Math.ceil((p * 2 * 1.2) / 1e9);
const qlora = (p: number) => Math.ceil((p * 0.5 * 1.5) / 1e9 + 6);

function c(x: Omit<BaseModelCandidate, "servingVramGbBf16" | "qloraVramGb">): BaseModelCandidate {
  return { ...x, servingVramGbBf16: vram(x.parameters), qloraVramGb: qlora(x.parameters) };
}

export const VERIFIED_ON = "2026-11-10";

export const BASE_MODEL_CANDIDATES: BaseModelCandidate[] = [
  c({
    id: "Qwen/Qwen3-8B",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 8_190_735_360,
    contextLength: 40_960,
    arabicFirst: false,
    architecture: "Qwen3ForCausalLM",
    gated: false,
    ollamaTag: "qwen3:8b",
    notes: "Multilingual causal LM with native tool calling; first-class PEFT/TRL, vLLM and Ollama support.",
    role: "production_default",
  }),
  c({
    id: "humain-ai/ALLaM-7B-Instruct-preview",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 7_000_559_616,
    contextLength: 4_096,
    arabicFirst: true,
    architecture: "LlamaForCausalLM",
    gated: false,
    notes: "Saudi Arabic-first model. 4K context limits retrieval + memory budget.",
    role: "arabic_challenger",
  }),
  c({
    id: "Qwen/Qwen3.5-9B",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 9_653_104_368,
    contextLength: 262_144,
    arabicFirst: false,
    architecture: "Qwen3_5ForConditionalGeneration",
    gated: false,
    notes: "Vision-language architecture with very long context; heavier fine-tuning path.",
    role: "candidate",
  }),
  c({
    id: "Qwen/Qwen3.5-4B",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 4_659_865_088,
    contextLength: 262_144,
    arabicFirst: false,
    architecture: "Qwen3_5ForConditionalGeneration",
    gated: false,
    notes: "Smaller vision-language option.",
    role: "candidate",
  }),
  c({
    id: "QCRI/Fanar-1-9B-Instruct",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 8_783_871_488,
    contextLength: 4_096,
    arabicFirst: true,
    architecture: "Gemma2ForCausalLM",
    gated: false,
    notes: "Arabic-first, Gemma-2 based; 4K context.",
    role: "candidate",
  }),
  c({
    id: "inception42/jais-family-13b-chat",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 13_462_730_280,
    contextLength: null,
    arabicFirst: true,
    architecture: "JAISLMHeadModel",
    gated: false,
    notes: "Custom architecture requiring trust_remote_code; not served by every runtime.",
    role: "candidate",
  }),
  c({
    id: "silma-ai/SILMA-9B-Instruct-v1.0",
    license: "gemma",
    commercialUse: "conditional",
    parameters: 9_241_705_984,
    contextLength: 8_192,
    arabicFirst: true,
    architecture: "Gemma2ForCausalLM",
    gated: false,
    notes: "Gemma terms of use apply (use restrictions).",
    role: "candidate",
  }),
  c({
    id: "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 24_011_361_280,
    contextLength: 131_072,
    arabicFirst: false,
    architecture: "Mistral3ForConditionalGeneration",
    gated: false,
    notes: "Larger multilingual model tagged for Arabic; needs a large GPU.",
    role: "candidate",
  }),
  c({
    id: "Qwen/Qwen2.5-0.5B-Instruct",
    license: "apache-2.0",
    commercialUse: "permitted",
    parameters: 494_032_768,
    contextLength: 32_768,
    arabicFirst: false,
    architecture: "Qwen2ForCausalLM",
    gated: false,
    ollamaTag: "qwen2.5:0.5b",
    notes: "Development and CI only. Small enough for CPU; not a production-quality model.",
    role: "dev_ci",
  }),
];

export function findCandidate(id: string): BaseModelCandidate | undefined {
  return BASE_MODEL_CANDIDATES.find((m) => m.id === id);
}

/** Embedding models with a matching partial HNSW index in the schema. */
export const EMBEDDING_MODELS = {
  "intfloat/multilingual-e5-small": { dims: 384, license: "mit", onnx: "Xenova/multilingual-e5-small", ollamaTag: null, prefixes: true },
  "BAAI/bge-m3": { dims: 1024, license: "mit", onnx: null, ollamaTag: "bge-m3", prefixes: false },
} as const;
export type EmbeddingModelId = keyof typeof EMBEDDING_MODELS;
