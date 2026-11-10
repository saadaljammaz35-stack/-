import "server-only";
import { z } from "zod";
import { hasScope, type AuthContext } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { withUser } from "@/lib/db/pool";
import { safeFetchText } from "@/lib/security/ssrf";
import type { ModelProfile, ToolName } from "../identity/model-config";
import type { ToolCall, ToolSpec } from "../providers/types";
import { hybridSearch } from "../rag/retrieve";

// Tool execution layer. The model only ever *requests* a tool; this module
// decides. Every call passes authorizeToolCall() — profile allow-list, API
// key scopes, per-turn limit, argument validation — and runs as the calling
// user inside RLS. Tools have no direct access to platform tables or files.

interface ToolDef<A extends z.ZodType> {
  name: ToolName;
  description: string;
  args: A;
  /** API-key scope required in addition to the profile allow-list. */
  scope?: "knowledge:read";
  enabled: () => boolean;
  run: (ctx: AuthContext, args: z.infer<A>, signal: AbortSignal) => Promise<unknown>;
}

/** Keeps each tool's argument type precise while storing them in one map. */
function tool<A extends z.ZodType>(d: ToolDef<A>): ToolDef<z.ZodType> {
  return d as unknown as ToolDef<z.ZodType>;
}

const defs: Record<ToolName, ToolDef<z.ZodType>> = {
  knowledge_search: tool({
    name: "knowledge_search",
    description: "Search the owner's private knowledge base and return the most relevant passages with their source titles.",
    args: z.object({ query: z.string().min(2).max(500), top_k: z.number().int().min(1).max(8).optional() }).strict(),
    scope: "knowledge:read",
    enabled: () => true,
    run: async (ctx, a) =>
      withUser(ctx.userId, async (db) =>
        (await hybridSearch(db, { workspaceId: ctx.workspaceId, query: a.query, topK: a.top_k ?? 4 }))
          .filter((c) => c.relevant)
          .map((c) => ({ title: c.documentTitle, page: c.page, text: c.content.slice(0, 1500) })),
      ),
  }),
  current_time: tool({
    name: "current_time",
    description: "Get the current date and time in UTC and in Riyadh.",
    args: z.object({}).strict(),
    enabled: () => true,
    run: async () => {
      const now = new Date();
      return {
        utc: now.toISOString(),
        riyadh: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", dateStyle: "full", timeStyle: "short" }).format(now),
      };
    },
  }),
  fetch_url: tool({
    name: "fetch_url",
    description: "Fetch the text of a public web page (http/https). Internal and private addresses are refused.",
    args: z.object({ url: z.string().url().max(2000) }).strict(),
    enabled: () => env().OMNIX_ENABLE_FETCH_TOOL,
    run: async (_ctx, a, signal) => {
      const r = await safeFetchText(a.url, { maxBytes: 300_000, timeoutMs: 10_000, signal });
      const text = r.contentType.includes("html")
        ? r.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
        : r.text;
      return { status: r.status, truncated: r.truncated, text: text.slice(0, 12_000) };
    },
  }),
};

export function availableTools(profile: ModelProfile, ctx: AuthContext): ToolSpec[] {
  if (profile.maxToolCalls <= 0) return [];
  return profile.configuration.tools.allowed
    .map((n) => defs[n])
    .filter((d) => d.enabled() && (!d.scope || hasScope(ctx, d.scope)))
    .map((d) => ({ name: d.name, description: d.description, parameters: z.toJSONSchema(d.args) as Record<string, unknown> }));
}

export type ToolDecision = { allowed: true; def: ToolDef<z.ZodType>; args: unknown } | { allowed: false; reason: string };

export function authorizeToolCall(profile: ModelProfile, ctx: AuthContext, call: ToolCall, callsSoFar: number): ToolDecision {
  if (callsSoFar >= profile.maxToolCalls) return { allowed: false, reason: "tool call limit reached for this turn" };
  const def = (defs as Record<string, ToolDef<z.ZodType>>)[call.name];
  if (!def) return { allowed: false, reason: `unknown tool ${call.name}` };
  if (!profile.configuration.tools.allowed.includes(def.name)) return { allowed: false, reason: `tool ${call.name} is not enabled for this model` };
  if (!def.enabled()) return { allowed: false, reason: `tool ${call.name} is disabled on this server` };
  if (def.scope && !hasScope(ctx, def.scope)) return { allowed: false, reason: `API key lacks ${def.scope}` };
  let raw: unknown;
  try {
    raw = call.arguments.trim() ? JSON.parse(call.arguments) : {};
  } catch {
    return { allowed: false, reason: "arguments are not valid JSON" };
  }
  const parsed = def.args.safeParse(raw);
  if (!parsed.success) return { allowed: false, reason: `invalid arguments: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  return { allowed: true, def, args: parsed.data };
}

export async function executeTool(def: ToolDef<z.ZodType>, ctx: AuthContext, args: unknown, signal: AbortSignal): Promise<string> {
  try {
    const out = await def.run(ctx, args, signal);
    return JSON.stringify(out).slice(0, 16_000);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message.slice(0, 300) : "tool failed" });
  }
}
