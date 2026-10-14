/**
 * Test double for `supabase.from(...)` used by the knowledge, assistant and
 * WhatsApp page tests. It records every query (operation, payload and
 * filters) and answers from in-memory fixtures. Contains no test-runner code
 * so it type-checks with the app.
 */

export type Operation = "select" | "insert" | "update" | "delete";

export interface RecordedQuery {
  table: string;
  op: Operation;
  payload: unknown;
  /** [method, column, value] for eq / in / lt … */
  filters: Array<[string, string, unknown]>;
}

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export type Responder = (query: RecordedQuery, single: boolean) => QueryResult | undefined;

export interface FakeSupabase {
  /** Rows returned by selects, per table (an array, or one object for maybeSingle). */
  tables: Record<string, unknown>;
  /** Every query that was awaited, in order. */
  queries: RecordedQuery[];
  /** Optional override; return undefined to fall back to the defaults. */
  respond: Responder | null;
  client: { from: (table: string) => unknown };
  reset: () => void;
  /** The recorded writes (insert/update/delete) to a table. */
  writes: (table: string, op?: Operation) => RecordedQuery[];
}

const FILTERS = ["eq", "neq", "in", "lt", "lte", "gt", "gte", "is"] as const;
const PASS_THROUGH = ["order", "limit", "range"] as const;

export function createFakeSupabase(): FakeSupabase {
  const fake: FakeSupabase = {
    tables: {},
    queries: [],
    respond: null,
    client: { from: (table: string) => query(table) },
    reset() {
      fake.tables = {};
      fake.queries.length = 0;
      fake.respond = null;
    },
    writes: (table, op) =>
      fake.queries.filter(
        (item) => item.table === table && item.op !== "select" && (!op || item.op === op),
      ),
  };

  function defaults(recorded: RecordedQuery, single: boolean): QueryResult {
    if (recorded.op === "select") {
      const rows = fake.tables[recorded.table];
      if (single) {
        return { data: Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null), error: null };
      }
      return { data: rows ?? [], error: null };
    }
    const id =
      recorded.filters.find(([method, column]) => method === "eq" && column === "id")?.[2] ??
      "new-row-id";
    return { data: single ? { id } : [{ id, organization_id: "affected" }], error: null };
  }

  function query(table: string) {
    const recorded: RecordedQuery = { table, op: "select", payload: undefined, filters: [] };
    const settle = (single: boolean) => {
      fake.queries.push(recorded);
      return Promise.resolve(fake.respond?.(recorded, single) ?? defaults(recorded, single));
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (payload: unknown) => {
        recorded.op = "insert";
        recorded.payload = payload;
        return chain;
      },
      update: (payload: unknown) => {
        recorded.op = "update";
        recorded.payload = payload;
        return chain;
      },
      delete: () => {
        recorded.op = "delete";
        return chain;
      },
      single: () => settle(true),
      maybeSingle: () => settle(true),
      then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
        settle(false).then(resolve, reject),
    };
    for (const method of FILTERS) {
      chain[method] = (column: string, value: unknown) => {
        recorded.filters.push([method, column, value]);
        return chain;
      };
    }
    for (const method of PASS_THROUGH) chain[method] = () => chain;
    return chain;
  }

  return fake;
}

/** True when a recorded query filtered on organization_id = orgId. */
export function filtersByOrg(recorded: RecordedQuery, orgId: string): boolean {
  return recorded.filters.some(
    ([method, column, value]) => method === "eq" && column === "organization_id" && value === orgId,
  );
}
