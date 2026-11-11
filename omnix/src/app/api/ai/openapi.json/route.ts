import { buildOpenApi } from "@/lib/api/openapi";
import { json, route } from "@/lib/http/route";

export const runtime = "nodejs";

export const GET = route.public({}, async () => json(buildOpenApi(), { headers: { "cache-control": "public, max-age=300" } }));
