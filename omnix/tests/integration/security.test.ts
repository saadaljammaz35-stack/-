import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { POST as addText } from "@/app/api/ai/knowledge/text/route";
import { POST as saveMemory } from "@/app/api/ai/memory/route";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as createKey } from "@/app/api/ai/api-keys/route";
import { DELETE as revokeKey } from "@/app/api/ai/api-keys/[id]/route";
import { GET as listModels } from "@/app/api/ai/models/route";
import { POST as addProvider } from "@/app/api/ai/providers/route";
import { POST as upload } from "@/app/api/ai/knowledge/upload/route";
import { processDocument } from "@/lib/ai/rag/knowledge";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, registerUser } from "./helpers";

// Row level security is verified at the SQL level with the application's own
// database role: even a query with no WHERE clause at all must not return
// another user's rows. A control that only lives in TypeScript is not a control.

const owner = ownerPool();
const app = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const worker = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL, max: 1 });
let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let aliceModel: string;

async function asUser<T>(userId: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    return await fn(c);
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}

beforeAll(async () => {
  alice = await registerUser(register, "Alice");
  bob = await registerUser(register, "Bob");
  aliceModel = (await jsonOf<{ profile: { id: string } }>(await call(createModel, { as: alice, body: { displayName: "Private AI", maxOutputTokens: 16 } }))).profile.id;
  const doc = await jsonOf<{ document: { id: string } }>(await call(addText, { as: alice, body: { title: "Secret plan", text: "The launch code name is Desert Rose." } }));
  await processDocument(alice.userId, doc.document.id);
  await call(saveMemory, { as: alice, body: { kind: "fact", content: "Alice is allergic to peanuts." } });
  await call(chat, { as: alice, body: { message: "hello" } });
});

afterAll(async () => {
  await Promise.all([owner.end(), app.end(), worker.end()]);
  await closePool();
});

describe("row level security, as the application role", () => {
  const tables = ["ai_model_profiles", "ai_model_versions", "ai_knowledge_documents", "ai_knowledge_chunks", "ai_memories", "ai_conversations", "ai_messages", "ai_usage_events", "ai_audit_events", "sessions", "workspaces"];

  it.each(tables)("Bob sees none of Alice's rows in %s, even with no WHERE clause", async (table) => {
    const total = Number((await owner.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
    expect(total).toBeGreaterThan(0);
    const aliceVisible = await asUser(alice.userId, async (c) => Number((await c.query(`SELECT count(*) FROM ${table}`)).rows[0].count));
    const bobVisible = await asUser(bob.userId, async (c) => {
      const cols = (await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table])).rows.map((r) => r.column_name as string);
      const ownerCol = cols.includes("owner_id") ? "owner_id" : cols.includes("actor_id") ? "actor_id" : cols.includes("user_id") ? "user_id" : null;
      const q = ownerCol ? `SELECT count(*) FROM ${table} WHERE ${ownerCol} = $1` : `SELECT count(*) FROM ${table} WHERE workspace_id = $1`;
      return Number((await c.query(q, [ownerCol ? alice.userId : alice.workspaceId])).rows[0].count);
    });
    expect(aliceVisible).toBeGreaterThan(0);
    expect(bobVisible).toBe(0);
  });

  it("without an identity, nothing is visible", async () => {
    const c = await app.connect();
    try {
      for (const t of tables) expect(Number((await c.query(`SELECT count(*) FROM ${t}`)).rows[0].count)).toBe(0);
    } finally {
      c.release();
    }
  });

  it("Bob cannot write into Alice's model, conversation or workspace", async () => {
    await asUser(bob.userId, async (c) => {
      const r = await c.query("UPDATE ai_model_profiles SET display_name = 'pwned' WHERE id = $1", [aliceModel]);
      expect(r.rowCount).toBe(0);
    });
    await expect(
      asUser(bob.userId, (c) =>
        c.query("INSERT INTO ai_model_profiles (owner_id, workspace_id, display_name, slug) VALUES ($1, $2, 'x', 'x')", [alice.userId, alice.workspaceId]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(bob.userId, (c) => c.query("INSERT INTO ai_memories (owner_id, workspace_id, kind, content, source) VALUES ($1, $2, 'fact', 'x', 'explicit')", [bob.userId, alice.workspaceId])),
    ).rejects.toThrow(/row-level security/);
  });

  it("the app role cannot edit or delete audit history", async () => {
    await expect(asUser(alice.userId, (c) => c.query("DELETE FROM ai_audit_events"))).rejects.toThrow(/permission denied/);
    await expect(owner.query("UPDATE ai_audit_events SET action = 'x.y'")).rejects.toThrow(/append-only/);
  });

  it("the worker role cannot publish a deployed or pre-evaluated version", async () => {
    const v = (await owner.query("SELECT * FROM ai_model_versions WHERE model_profile_id = $1", [aliceModel])).rows[0];
    await expect(
      worker.query(
        `INSERT INTO ai_model_versions (model_profile_id, owner_id, version, base_model, provider_id, provider_model, status, evaluation_status)
         VALUES ($1, $2, '9.0.0', 'x', $3, 'x', 'deployed', 'passed')`,
        [aliceModel, alice.userId, v.provider_id],
      ),
    ).rejects.toThrow(/row-level security|permission denied/);
    await expect(worker.query("SELECT count(*) FROM ai_messages")).rejects.toThrow(/permission denied/);
    await expect(worker.query("SELECT count(*) FROM users")).rejects.toThrow(/permission denied/);
  });
});

describe("authentication hardening", () => {
  it("locks an account after repeated failures without revealing whether the email exists", async () => {
    const wrong = (email: string) => call(login, { body: { email, password: "wrong-password-1" }, headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` } });
    const unknown = await wrong("nobody@example.test");
    expect(unknown.status).toBe(401);
    const known = await wrong(alice.email);
    expect((await jsonOf<{ error: { message: string } }>(known)).error.message).toBe((await jsonOf<{ error: { message: string } }>(unknown)).error.message);
    for (let i = 0; i < 5; i++) await wrong(alice.email);
    const locked = await call(login, { body: { email: alice.email, password: "correct-horse-42" }, headers: { "x-forwarded-for": "10.200.1.1" } });
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
    await owner.query("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1", [alice.userId]);
  });

  it("stops accepting a revoked API key immediately", async () => {
    const k = await jsonOf<{ key: { id: string }; token: string }>(await call(createKey, { as: alice, body: { name: "temp", scopes: ["models:read"] } }));
    expect((await call(listModels, { as: { apiKey: k.token } })).status).toBe(200);
    expect((await call(revokeKey, { as: alice, method: "DELETE", params: { id: k.key.id } })).status).toBe(200);
    expect((await call(listModels, { as: { apiKey: k.token } })).status).toBe(401);
    const stored = await owner.query("SELECT token_hash FROM ai_api_keys WHERE id = $1", [k.key.id]);
    expect(stored.rows[0].token_hash.toString("utf8")).not.toContain(k.token.slice(13));
  });
});

describe("input and network hardening", () => {
  it("refuses provider endpoints on internal networks (SSRF) and plain http", async () => {
    for (const endpoint of ["https://127.0.0.1/v1", "https://169.254.169.254/latest", "https://10.0.0.5/v1", "http://8.8.8.8/v1", "https://localhost/v1"]) {
      const res = await call(addProvider, { as: alice, body: { providerName: `p${Math.random()}`, providerType: "openai_compatible", endpoint } });
      expect([403, 422]).toContain(res.status);
    }
  });

  it("rejects oversized uploads before reading them", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(26 * 1024 * 1024)], "big.txt"));
    const res = await call(upload, { as: alice, form });
    expect(res.status).toBe(413);
  });

  it("rejects unknown fields and wrong types in request bodies", async () => {
    const res = await call(createModel, { as: alice, body: { displayName: "x", isAdmin: true } });
    expect(res.status).toBe(422);
    const res2 = await call(chat, { as: alice, body: { message: 42 } });
    expect(res2.status).toBe(422);
  });

  it("never stores a provider API key in plain text", async () => {
    // A public https endpoint is required; the key must come back sealed.
    const res = await call(addProvider, { as: alice, body: { providerName: "hosted", providerType: "openai_compatible", endpoint: "https://8.8.8.8/v1", apiKey: "sk-live-supersecretvalue123456" } });
    expect(res.status).toBe(201);
    expect(await res.text()).not.toContain("supersecret");
    const row = await owner.query("SELECT secret_reference, secret_hint FROM ai_model_connections WHERE owner_id = $1", [alice.userId]);
    expect(row.rows[0].secret_reference).toMatch(/^enc:v1:/);
    expect(row.rows[0].secret_reference).not.toContain("supersecret");
    expect(row.rows[0].secret_hint).toBe("…3456");
  });
});
