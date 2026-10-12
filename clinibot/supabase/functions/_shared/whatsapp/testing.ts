// Test doubles for the WhatsApp library and the staff messaging functions.
// Not imported by any function at runtime.
//
// FakeDb is a small in-memory stand-in for the supabase-js query builder. It
// records every call and refuses updates and deletes on tenant tables that are
// not filtered by organization_id, so a missing tenant filter fails the test.

import type { Db } from "../db.ts";
import { toBase64 } from "../crypto.ts";
import { saveCredentials } from "./integration.ts";

export type Row = Record<string, unknown>;
export type Action = "select" | "insert" | "update" | "upsert" | "delete";

export interface Filter {
  op: "eq" | "neq" | "is" | "in";
  column: string;
  value: unknown;
}

export interface Call {
  table: string;
  action: Action;
  filters: Filter[];
  values?: Row | Row[];
  columns?: string;
}

export interface DbError {
  code?: string;
  message?: string;
}

export interface FakeDbOptions {
  tables?: Record<string, Row[]>;
  /** Access token → user id, for auth.getUser. */
  users?: Record<string, string>;
  /** Columns that must be unique per table (a violation returns code 23505). */
  unique?: Record<string, string[]>;
  /** Column defaults applied on insert. */
  defaults?: Record<string, () => Row>;
  /** Return an error for a matching call instead of executing it. */
  fail?: (call: Call) => DbError | null;
  rateLimited?: boolean;
}

const TENANT_TABLES = new Set([
  "integration_settings",
  "integration_credentials",
  "conversations",
  "messages",
  "appointment_requests",
  "clinic_settings",
  "clinic_services",
]);

export const DEFAULTS: Record<string, () => Row> = {
  integration_settings: () => ({
    provider: "whatsapp",
    status: "disconnected",
    phone_number_id: null,
    waba_id: null,
    display_phone_number: null,
    verified_name: null,
    webhook_key: "ab".repeat(18),
    credentials_verified_at: null,
    webhook_verified_at: null,
    last_inbound_at: null,
    last_error: null,
    last_error_at: null,
    confirmation_template_name: null,
    confirmation_template_language: "ar",
  }),
  messages: () => ({ error_code: null, created_at: new Date().toISOString() }),
};

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.column] ?? null;
    switch (filter.op) {
      case "eq":
        return value !== null && value === filter.value;
      case "neq":
        return value !== filter.value;
      case "is":
        return value === filter.value;
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(value);
    }
  });
}

function pick(row: Row, columns: string | undefined): Row {
  if (!columns || columns.trim() === "*") return { ...row };
  const out: Row = {};
  for (const column of columns.split(",").map((c) => c.trim()).filter(Boolean)) out[column] = row[column] ?? null;
  return out;
}

type Result = { data: unknown; error: DbError | null };

class FakeQuery implements PromiseLike<Result> {
  private action: Action = "select";
  private filters: Filter[] = [];
  private values?: Row | Row[];
  private columns?: string;
  private returning = false;
  private onConflict?: string;
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(private readonly db: FakeDb, private readonly table: string) {}

  select(columns?: string): this {
    if (this.action === "select") this.columns = columns;
    else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }
  insert(values: Row | Row[]): this {
    this.action = "insert";
    this.values = values;
    return this;
  }
  update(values: Row): this {
    this.action = "update";
    this.values = values;
    return this;
  }
  upsert(values: Row | Row[], options?: { onConflict?: string }): this {
    this.action = "upsert";
    this.values = values;
    this.onConflict = options?.onConflict;
    return this;
  }
  delete(): this {
    this.action = "delete";
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ op: "neq", column, value });
    return this;
  }
  is(column: string, value: unknown): this {
    this.filters.push({ op: "is", column, value });
    return this;
  }
  in(column: string, value: unknown[]): this {
    this.filters.push({ op: "in", column, value });
    return this;
  }
  order(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  single(): this {
    this.mode = "single";
    return this;
  }
  maybeSingle(): this {
    this.mode = "maybeSingle";
    return this;
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return new Promise<Result>((resolve) => resolve(this.execute())).then(onfulfilled, onrejected);
  }

  private execute(): Result {
    const call: Call = {
      table: this.table,
      action: this.action,
      filters: [...this.filters],
      values: this.values,
      columns: this.columns,
    };
    this.db.calls.push(call);
    if (
      (this.action === "update" || this.action === "delete") &&
      TENANT_TABLES.has(this.table) &&
      !this.filters.some((f) => f.op === "eq" && f.column === "organization_id")
    ) {
      throw new Error(`unscoped ${this.action} on ${this.table}: missing organization_id filter`);
    }
    const injected = this.db.options.fail?.(call);
    if (injected) return { data: null, error: injected };

    const rows = this.db.table(this.table);
    let affected: Row[];
    switch (this.action) {
      case "select":
        affected = rows.filter((row) => matches(row, this.filters));
        break;
      case "insert": {
        const inserted = this.db.insertRows(this.table, this.values);
        if ("error" in inserted) return { data: null, error: inserted.error };
        affected = inserted.rows;
        break;
      }
      case "update": {
        affected = rows.filter((row) => matches(row, this.filters));
        const conflict = this.db.uniqueConflict(this.table, affected, this.values as Row);
        if (conflict) return { data: null, error: conflict };
        for (const row of affected) Object.assign(row, this.values, { updated_at: new Date().toISOString() });
        break;
      }
      case "upsert": {
        affected = [];
        const keys = (this.onConflict ?? "id").split(",").map((k) => k.trim());
        for (const value of Array.isArray(this.values) ? this.values : [this.values ?? {}]) {
          const existing = rows.find((row) => keys.every((key) => row[key] === value[key]));
          if (existing) {
            const conflict = this.db.uniqueConflict(this.table, [existing], value);
            if (conflict) return { data: null, error: conflict };
            Object.assign(existing, value, { updated_at: new Date().toISOString() });
            affected.push(existing);
          } else {
            const inserted = this.db.insertRows(this.table, value);
            if ("error" in inserted) return { data: null, error: inserted.error };
            affected.push(...inserted.rows);
          }
        }
        break;
      }
      case "delete":
        affected = rows.filter((row) => matches(row, this.filters));
        this.db.tables[this.table] = rows.filter((row) => !affected.includes(row));
        break;
    }

    if (this.action !== "select" && !this.returning && this.mode === "many") return { data: null, error: null };
    const data = affected.map((row) => pick(row, this.columns));
    if (this.mode === "many") return { data, error: null };
    if (data.length > 1 || (this.mode === "single" && data.length === 0)) {
      return { data: null, error: { code: "PGRST116", message: `expected one row, got ${data.length}` } };
    }
    return { data: data[0] ?? null, error: null };
  }
}

export class FakeDb {
  readonly tables: Record<string, Row[]>;
  readonly calls: Call[] = [];
  readonly rpcs: { fn: string; args: Record<string, unknown> }[] = [];

  constructor(readonly options: FakeDbOptions = {}) {
    this.tables = structuredClone(options.tables ?? {});
  }

  get db(): Db {
    return this as unknown as Db;
  }

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
    this.rpcs.push({ fn, args });
    const injected = this.options.fail?.({ table: `rpc:${fn}`, action: "select", filters: [] });
    if (injected) return Promise.resolve({ data: null, error: injected });
    if (fn === "consume_rate_limit") return Promise.resolve({ data: !this.options.rateLimited, error: null });
    if (fn === "write_audit") return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
  }

  readonly auth = {
    getUser: (token: string) => {
      const id = this.options.users?.[token];
      return Promise.resolve(
        id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: "invalid token", status: 401 } },
      );
    },
  };

  /** Audit entries written through write_audit. */
  get audits(): { action: string; org: unknown; entity: unknown; details: Record<string, unknown> }[] {
    return this.rpcs
      .filter((r) => r.fn === "write_audit")
      .map((r) => ({
        action: String(r.args.p_action),
        org: r.args.p_org,
        entity: r.args.p_entity_id,
        details: r.args.p_details as Record<string, unknown>,
      }));
  }

  callsTo(table: string, action?: Action): Call[] {
    return this.calls.filter((c) => c.table === table && (action === undefined || c.action === action));
  }

  insertRows(table: string, values: Row | Row[] | undefined): { rows: Row[] } | { error: DbError } {
    const rows = this.table(table);
    const inserted: Row[] = [];
    for (const value of Array.isArray(values) ? values : [values ?? {}]) {
      const defaults = (this.options.defaults?.[table] ?? DEFAULTS[table])?.() ?? {};
      const row: Row = { id: crypto.randomUUID(), ...defaults, ...value };
      const conflict = this.uniqueConflict(table, [], row);
      if (conflict) return { error: conflict };
      inserted.push(row);
    }
    rows.push(...inserted);
    return { rows: inserted };
  }

  uniqueConflict(table: string, self: Row[], values: Row): DbError | null {
    for (const column of ["id", ...(this.options.unique?.[table] ?? [])]) {
      const value = values[column];
      if (value === undefined || value === null) continue;
      if (this.table(table).some((row) => !self.includes(row) && row[column] === value)) {
        return { code: "23505", message: `duplicate key value violates unique constraint on ${column}` };
      }
    }
    return null;
  }
}

/** True when the call carries an organization_id = orgId filter. */
export function scopedTo(call: Call, orgId: string): boolean {
  return call.filters.some((f) => f.op === "eq" && f.column === "organization_id" && f.value === orgId);
}

export interface FetchCall {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

export type FetchReply = Response | Error | ((call: FetchCall) => Response | Error);

/** Fake fetch that answers from a queue of replies and records each request. */
export function fakeFetch(...replies: FetchReply[]): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const impl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = typeof init?.body === "string" ? init.body : null;
    const call: FetchCall = {
      url: String(input instanceof Request ? input.url : input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: raw === null ? null : JSON.parse(raw),
    };
    calls.push(call);
    const next = replies.shift();
    if (next === undefined) return Promise.reject(new Error("unexpected fetch"));
    const reply = typeof next === "function" ? next(call) : next;
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  return { fetch: impl as typeof fetch, calls };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function metaError(code: number, message: string, status = 400, details?: string): Response {
  return jsonResponse(
    {
      error: {
        message,
        type: "OAuthException",
        code,
        error_subcode: 2494010,
        fbtrace_id: "AbCdEfGh123",
        ...(details ? { error_data: { messaging_product: "whatsapp", details } } : {}),
      },
    },
    status,
  );
}

/** A fixed 32-byte key; every test file uses the same one because the module caches it. */
export const TEST_ENCRYPTION_KEY = toBase64(new Uint8Array(32).map((_, i) => 255 - i));

export function setTestEnv(): void {
  Deno.env.set("CREDENTIALS_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  Deno.env.delete("WHATSAPP_GRAPH_VERSION");
}

export function staffRequest(body: unknown, token: string | null = "token-owner"): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/fn", { method: "POST", headers, body: JSON.stringify(body) });
}

/** Stores real (encrypted) credentials for an integration row, as whatsapp-connect would. */
export async function saveTestCredentials(
  db: FakeDb,
  row: Row,
  accessToken: string,
  verifyTokenHash: string | null = null,
  appSecret: string | null = "test-app-secret-0123456789",
): Promise<void> {
  await saveCredentials(
    db.db,
    { id: String(row.id), organization_id: String(row.organization_id) },
    { accessToken, appSecret, verifyTokenHash },
  );
}
