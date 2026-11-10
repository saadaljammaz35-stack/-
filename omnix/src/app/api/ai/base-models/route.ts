import { BASE_MODEL_CANDIDATES, EMBEDDING_MODELS, VERIFIED_ON } from "@/lib/ai/models/catalog";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** The base-model comparison catalog (verified metadata only; quality comes from evaluation runs). */
export const GET = route.auth({ scope: "models:read" }, async () => ({ verifiedOn: VERIFIED_ON, candidates: BASE_MODEL_CANDIDATES, embeddingModels: EMBEDDING_MODELS }));
