// Test doubles for the assistant and the functions that use it. Not imported
// by any entrypoint, so never deployed.
//
// FakeDb records every query (table, operation, filters, values) so tests can
// assert that each one is scoped to the right clinic, and answers through a
// responder the test supplies.

import type { Anthropic } from "../deps.ts";
import type { Db } from "../db.ts";
import type { MessagesClientLike, MessageCreateParams } from "./claude.ts";

export interface Filter {
  column: string;
  op: string;
  value: unknown;
}

export interface RecordedQuery {
  table: string;
  operation: "select" | "insert" | "update" | "delete" | "upsert";
  columns: string | null;
  options: Record<string, unknown> | null;
  values: unknown;
  filters: Filter[];
  orders: Array<{ column: string; ascending: boolean }>;
  limit: number | null;
  single: "single" | "maybeSingle" | null;
  returning: boolean;
}

export interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type QueryResponder = (query: RecordedQuery) => FakeResult | undefined;
export type RpcResponder = (name: string, params: Record<string, unknown>) => FakeResult | undefined;

export interface RecordedRpc {
  name: string;
  params: Record<string, unknown>;
}

class FakeQuery {
  readonly query: RecordedQuery;

  constructor(private readonly owner: FakeDb, table: string) {
    this.query = {
      table,
      operation: "select",
      columns: null,
      options: null,
      values: null,
      filters: [],
      orders: [],
      limit: null,
      single: null,
      returning: false,
    };
  }

  select(columns = "*", options: Record<string, unknown> | null = null): this {
    if (this.query.operation === "select") {
      this.query.columns = columns;
      this.query.options = options;
    } else {
      this.query.returning = true;
      this.query.columns = columns;
    }
    return this;
  }

  insert(values: unknown): this {
    this.query.operation = "insert";
    this.query.values = values;
    return this;
  }

  upsert(values: unknown): this {
    this.query.operation = "upsert";
    this.query.values = values;
    return this;
  }

  update(values: unknown): this {
    this.query.operation = "update";
    this.query.values = values;
    return this;
  }

  delete(options: Record<string, unknown> | null = null): this {
    this.query.operation = "delete";
    this.query.options = options;
    return this;
  }

  private filter(op: string, column: string, value: unknown): this {
    this.query.filters.push({ column, op, value });
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter("eq", column, value);
  }
  neq(column: string, value: unknown): this {
    return this.filter("neq", column, value);
  }
  gt(column: string, value: unknown): this {
    return this.filter("gt", column, value);
  }
  gte(column: string, value: unknown): this {
    return this.filter("gte", column, value);
  }
  lt(column: string, value: unknown): this {
    return this.filter("lt", column, value);
  }
  lte(column: string, value: unknown): this {
    return this.filter("lte", column, value);
  }
  is(column: string, value: unknown): this {
    return this.filter("is", column, value);
  }
  in(column: string, value: unknown): this {
    return this.filter("in", column, value);
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.query.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  single(): this {
    this.query.single = "single";
    return this;
  }

  maybeSingle(): this {
    this.query.single = "maybeSingle";
    return this;
  }

  // Awaiting the builder runs the query, as with supabase-js.
  // deno-lint-ignore no-thenable
  then<T1 = unknown, T2 = never>(
    onFulfilled?: ((value: { data: unknown; error: unknown; count: number | null }) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve(this.owner.execute(this.query)).then(onFulfilled, onRejected);
  }
}

export class FakeDb {
  readonly queries: RecordedQuery[] = [];
  readonly rpcs: RecordedRpc[] = [];
  readonly auth: {
    getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };

  constructor(
    private readonly respond: QueryResponder = () => undefined,
    private readonly respondRpc: RpcResponder = () => undefined,
    users: Record<string, string> = {},
  ) {
    this.auth = {
      getUser: (token: string) => {
        const id = users[token];
        return Promise.resolve(
          id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "invalid" } },
        );
      },
    };
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  rpc(name: string, params: Record<string, unknown> = {}): Promise<{ data: unknown; error: unknown }> {
    this.rpcs.push({ name, params });
    const result = this.respondRpc(name, params) ?? {};
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  }

  execute(query: RecordedQuery): { data: unknown; error: unknown; count: number | null } {
    this.queries.push(structuredClone(query));
    const result = this.respond(query) ?? {};
    const fallback = query.operation === "select" && query.single === null ? [] : null;
    return {
      data: result.data === undefined ? fallback : result.data,
      error: result.error ?? null,
      count: result.count ?? null,
    };
  }

  asDb(): Db {
    return this as unknown as Db;
  }

  /** Queries against one table, optionally of one operation. */
  on(table: string, operation?: RecordedQuery["operation"]): RecordedQuery[] {
    return this.queries.filter((q) => q.table === table && (operation === undefined || q.operation === operation));
  }
}

export function filterValue(query: RecordedQuery, column: string, op = "eq"): unknown {
  return query.filters.find((filter) => filter.column === column && filter.op === op)?.value;
}

export function hasFilter(query: RecordedQuery, column: string, value: unknown, op = "eq"): boolean {
  return query.filters.some((filter) => filter.column === column && filter.op === op && filter.value === value);
}

// ───────────────────────────── in-memory tables ─────────────────────────────

export type Row = Record<string, unknown>;

function compare(actual: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "is":
      return actual === expected || (expected === null && actual === undefined);
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (actual === null || actual === undefined) return false;
      const a = actual as string | number;
      const b = expected as string | number;
      return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
    }
  }
  throw new Error(`fake db: unsupported filter ${op}`);
}

function project(row: Row, columns: string | null): Row {
  if (columns === null || columns.trim() === "*") return { ...row };
  const out: Row = {};
  for (const column of columns.split(",").map((c) => c.trim()).filter(Boolean)) out[column] = row[column];
  return out;
}

/**
 * A responder backed by plain arrays: filters, ordering, limits, counts,
 * inserts, updates and deletes behave like PostgREST for the calls the
 * functions make. Rows of every clinic live in the same arrays, so a query
 * that forgets its organization filter returns another clinic's rows.
 */
export function memoryResponder(
  tables: Record<string, Row[]>,
  defaults: Record<string, Row> = {},
): QueryResponder {
  let clock = Date.parse("2026-10-12T09:00:00.000Z");
  const nextTimestamp = () => new Date(clock += 1000).toISOString();
  return (query) => {
    const rows = tables[query.table] ??= [];
    const matches = (row: Row) => query.filters.every((f) => compare(row[f.column], f.op, f.value));
    switch (query.operation) {
      case "select": {
        const found = rows.filter(matches);
        found.sort((a, b) => {
          for (const order of query.orders) {
            const x = a[order.column] as string | number;
            const y = b[order.column] as string | number;
            if (x === y) continue;
            return (x < y ? -1 : 1) * (order.ascending ? 1 : -1);
          }
          return 0;
        });
        const count = query.options?.count ? found.length : null;
        if (query.options?.head) return { data: null, count };
        const limited = query.limit === null ? found : found.slice(0, query.limit);
        const projected = limited.map((row) => project(row, query.columns));
        if (query.single !== null) {
          if (projected.length > 1) return { error: { message: "multiple rows", code: "PGRST116" } };
          if (projected.length === 0 && query.single === "single") {
            return { error: { message: "no rows", code: "PGRST116" } };
          }
          return { data: projected[0] ?? null, count };
        }
        return { data: projected, count };
      }
      case "insert":
      case "upsert": {
        const values = (Array.isArray(query.values) ? query.values : [query.values]) as Row[];
        const inserted = values.map((value) => ({
          id: crypto.randomUUID(),
          created_at: nextTimestamp(),
          ...defaults[query.table],
          ...value,
        }));
        rows.push(...inserted);
        if (!query.returning) return { data: null };
        const projected = inserted.map((row) => project(row, query.columns));
        return { data: query.single !== null ? projected[0] ?? null : projected };
      }
      case "update": {
        const updated = rows.filter(matches);
        for (const row of updated) Object.assign(row, query.values as Row);
        if (!query.returning) return { data: null, count: updated.length };
        const projected = updated.map((row) => project(row, query.columns));
        return { data: query.single !== null ? projected[0] ?? null : projected };
      }
      case "delete": {
        const kept = rows.filter((row) => !matches(row));
        const removed = rows.length - kept.length;
        rows.splice(0, rows.length, ...kept);
        return { data: null, count: query.options?.count ? removed : null };
      }
    }
  };
}

// ───────────────────────────── Claude fakes ─────────────────────────────

export type Block = Record<string, unknown>;

export function message(
  stopReason: string,
  content: Block[],
  usage: Partial<Record<"input_tokens" | "output_tokens" | "cache_read_input_tokens", number>> = {},
  extra: Record<string, unknown> = {},
): Anthropic.Beta.BetaMessage {
  return {
    id: `msg_${crypto.randomUUID()}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: usage.input_tokens ?? 100,
      output_tokens: usage.output_tokens ?? 20,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
      fallback_credit: null,
      inference_geo: null,
      iterations: null,
      output_tokens_details: null,
    },
    ...extra,
  } as unknown as Anthropic.Beta.BetaMessage;
}

export const thinking = (): Block => ({ type: "thinking", thinking: "", signature: "sig-abc" });
export const text = (value: string): Block => ({ type: "text", text: value, citations: null });
export const toolUse = (name: string, input: unknown, id = `toolu_${crypto.randomUUID()}`): Block => ({
  type: "tool_use",
  id,
  name,
  input,
});

export class FakeClaude implements MessagesClientLike {
  readonly calls: MessageCreateParams[] = [];
  readonly beta: MessagesClientLike["beta"];

  constructor(private readonly responses: Array<Anthropic.Beta.BetaMessage | Error>) {
    this.beta = {
      messages: {
        create: (params: MessageCreateParams) => {
          this.calls.push(structuredClone(params));
          const next = this.responses.shift();
          if (next === undefined) return Promise.reject(new Error("FakeClaude: no response queued"));
          if (next instanceof Error) return Promise.reject(next);
          return Promise.resolve(next);
        },
      },
    };
  }
}
