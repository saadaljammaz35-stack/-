import { loadProvider } from "@/lib/ai/providers/registry";
import { ProviderError } from "@/lib/ai/providers/types";
import { withUser } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.auth({ scope: "models:read" }, async ({ auth, params }) => {
  const id = parseId(params.id, "Provider");
  return withUser(auth.userId, async (db) => {
    const { provider } = await loadProvider(db, id);
    try {
      return { models: await provider.listModels() };
    } catch (err) {
      if (err instanceof ProviderError) throw new AppError("PROVIDER_UNAVAILABLE", err.message);
      throw err;
    }
  });
});
