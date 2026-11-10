import { OpenAICompatibleProvider } from "./openai-compatible";
import { providerFetch } from "./resilience";
import { ProviderError, type ProviderCapabilities, type ProviderHealth, type ProviderType } from "./types";

/**
 * vLLM: OpenAI-compatible server plus `/health`, `max_model_len` in
 * `/v1/models`, and run-time LoRA adapter loading
 * (`/v1/load_lora_adapter`, requires VLLM_ALLOW_RUNTIME_LORA_UPDATING=True
 * and --enable-lora on the server). A loaded adapter is addressed by its
 * name in the `model` field.
 */
export class VllmProvider extends OpenAICompatibleProvider {
  override readonly type: ProviderType = "vllm";

  override async healthCheck(signal?: AbortSignal): Promise<ProviderHealth> {
    const t = performance.now();
    try {
      await providerFetch(`${this.root}/health`, { method: "GET", headers: this.headers(), timeoutMs: 5000, signal });
      const v = await providerFetch(`${this.root}/version`, { method: "GET", headers: this.headers(), timeoutMs: 5000, signal })
        .then((r) => r.json() as Promise<{ version?: string }>)
        .catch(() => ({}) as { version?: string });
      return { status: "healthy", latencyMs: Math.round(performance.now() - t), version: v.version };
    } catch (err) {
      return { status: "down", latencyMs: Math.round(performance.now() - t), error: (err as Error).message };
    }
  }

  override async getCapabilities(): Promise<ProviderCapabilities> {
    return { streaming: true, toolCalling: true, vision: false, embeddings: false, loadUnload: true, loraAdapters: true };
  }

  override async loadModel(_model: string, opts?: { adapterName?: string; adapterPath?: string }): Promise<void> {
    if (!opts?.adapterName || !opts.adapterPath) {
      throw new ProviderError("unsupported", "vLLM loads base models at server start; only LoRA adapters load at run time");
    }
    await providerFetch(`${this.v1}/load_lora_adapter`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ lora_name: opts.adapterName, lora_path: opts.adapterPath }),
      timeoutMs: 120_000,
    });
  }

  override async unloadModel(_model: string, opts?: { adapterName?: string }): Promise<void> {
    if (!opts?.adapterName) throw new ProviderError("unsupported", "Only LoRA adapters can be unloaded at run time");
    await providerFetch(`${this.v1}/unload_lora_adapter`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ lora_name: opts.adapterName }),
      timeoutMs: 60_000,
    });
  }
}
