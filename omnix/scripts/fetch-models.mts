// Downloads the open-weight models used by the in-process (local_onnx)
// provider and embedder into OMNIX_MODELS_DIR (default ./.models), so the app
// and the tests can run without any model server.
//
//   node scripts/fetch-models.mts            chat model + embedder
//   node scripts/fetch-models.mts --embedder embedder only (fast, ~120 MB)
//
// Licences (verified on the Hugging Face Hub): Qwen2.5-0.5B-Instruct is
// Apache-2.0; multilingual-e5-small is MIT.
import { env, pipeline } from "@huggingface/transformers";
import path from "node:path";

env.cacheDir = path.resolve(process.env.OMNIX_MODELS_DIR ?? ".models");
env.allowRemoteModels = true;

const chatModel = process.env.OMNIX_LOCAL_ONNX_MODEL ?? "onnx-community/Qwen2.5-0.5B-Instruct";
const chatDtype = (process.env.OMNIX_LOCAL_ONNX_DTYPE ?? "q8") as "q8";
const embedModel = process.env.OMNIX_LOCAL_EMBEDDING_ONNX ?? "Xenova/multilingual-e5-small";

const started = Date.now();
const emb = await pipeline("feature-extraction", embedModel, { dtype: "q8" });
const out = await emb(["query: مرحبا", "query: hello"], { pooling: "mean", normalize: true });
console.log(`embedder ready: ${embedModel} dims=${out.dims.at(-1)} (${Date.now() - started} ms)`);
await emb.dispose();

if (!process.argv.includes("--embedder")) {
  const t = Date.now();
  const gen = await pipeline("text-generation", chatModel, { dtype: chatDtype });
  const res = (await gen([{ role: "user", content: "Say OK." }], { max_new_tokens: 8, do_sample: false })) as unknown as {
    generated_text: { role: string; content: string }[];
  }[];
  console.log(`chat model ready: ${chatModel} (${chatDtype}) sample="${res[0]?.generated_text.at(-1)?.content}" (${Date.now() - t} ms)`);
  await gen.dispose();
}
console.log(`models cached in ${env.cacheDir}`);
