import { loadProvider, recordHealth } from "@/lib/ai/providers/registry";
import { withUser } from "@/lib/db/pool";
import { parseId, route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Live health check of a provider; the result is stored on the provider row. */
export const POST = route.auth(
  { scope: "models:read", rateLimit: { name: "provider-health", limit: 30, windowSec: 60 } },
  async ({ auth, params }) => {
    const id = parseId(params.id, "Provider");
    return withUser(auth.userId, async (db) => {
      const { provider } = await loadProvider(db, id);
      const health = await recordHealth(db, id, provider);
      const capabilities = await provider.getCapabilities();
      return { health, capabilities };
    });
  },
);
