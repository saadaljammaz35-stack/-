/**
 * Row-level security turns "not allowed" and "already gone" into an update or
 * delete that matches nothing, without an error. Callers add `.select("id")`
 * and pass the result here so the user is told instead of seeing a silent
 * no-op. The error looks like PostgREST's "no rows" (PGRST116), which
 * errorText() shows as "not found".
 */
export function ensureAffected<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) {
    throw Object.assign(new Error("No row was changed"), {
      code: "PGRST116",
      details: null,
      hint: null,
    });
  }
  return data;
}

/**
 * `placeholderData` that keeps showing the previous result while new filters
 * load, but only within the same clinic: after switching clinics nothing from
 * the previous one is ever shown (keys start with queryKeys.org(orgId)).
 */
export function keepWithinOrg(orgId: string) {
  return <T>(previous: T | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
    previousQuery?.queryKey[1] === orgId ? previous : undefined;
}
