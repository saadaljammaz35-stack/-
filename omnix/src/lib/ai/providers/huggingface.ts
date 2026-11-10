import { OpenAICompatibleProvider } from "./openai-compatible";
import { providerFetch } from "./resilience";
import { ProviderError, type ModelInfo, type ProviderCapabilities, type ProviderType } from "./types";

/**
 * Hugging Face hosted inference: the Inference Providers router
 * (https://router.huggingface.co/v1) and self-hosted TGI both speak the
 * OpenAI Chat Completions protocol. Model metadata (context length,
 * parameter count) comes from the Hub, a fixed host.
 */
export class HuggingFaceProvider extends OpenAICompatibleProvider {
  override readonly type: ProviderType = "huggingface";

  override async getCapabilities(): Promise<ProviderCapabilities> {
    return { streaming: true, toolCalling: true, vision: false, embeddings: false, loadUnload: false, loraAdapters: false };
  }

  override async getModelInfo(model: string): Promise<ModelInfo> {
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(model.split(":")[0]!)) {
      throw new ProviderError("bad_request", "Hugging Face model ids look like owner/name");
    }
    const repo = model.split(":")[0]!;
    const hdrs = this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : undefined;
    const meta = (await (await providerFetch(`https://huggingface.co/api/models/${repo}`, { headers: hdrs, timeoutMs: 10_000 })).json()) as {
      safetensors?: { total?: number };
      pipeline_tag?: string;
    };
    const cfg = (await providerFetch(`https://huggingface.co/${repo}/resolve/main/config.json`, { headers: hdrs, timeoutMs: 10_000 })
      .then((r) => r.json())
      .catch(() => ({}))) as { max_position_embeddings?: number; text_config?: { max_position_embeddings?: number }; model_type?: string };
    return {
      id: model,
      contextLength: cfg.text_config?.max_position_embeddings ?? cfg.max_position_embeddings ?? null,
      parameterCount: meta.safetensors?.total ?? null,
      family: cfg.model_type ?? null,
      capabilities: meta.pipeline_tag ? [meta.pipeline_tag] : [],
    };
  }
}
