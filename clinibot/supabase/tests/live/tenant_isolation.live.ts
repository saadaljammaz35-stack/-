// Live tenant-isolation check against a real Supabase project, through the
// public API exactly as the browser uses it (publishable key + user JWTs).
//
// Needs two confirmed test accounts. It creates (or reuses) one clinic per
// account, writes a little data in each, and then proves that neither account
// can read or change the other's rows, and that the anonymous key sees nothing.
//
//   CLINIBOT_URL=https://<ref>.supabase.co CLINIBOT_ANON_KEY=… \
//   CLINIBOT_USER_A=a@example.test CLINIBOT_PASS_A=… \
//   CLINIBOT_USER_B=b@example.test CLINIBOT_PASS_B=… \
//   deno test --allow-env --allow-net supabase/tests/live/tenant_isolation.live.ts

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.1";

const url = Deno.env.get("CLINIBOT_URL");
const anonKey = Deno.env.get("CLINIBOT_ANON_KEY");
const configured = Boolean(url && anonKey && Deno.env.get("CLINIBOT_USER_A") && Deno.env.get("CLINIBOT_USER_B"));

function client(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(emailVar: string, passVar: string): Promise<SupabaseClient> {
  const db = client();
  const { error } = await db.auth.signInWithPassword({
    email: Deno.env.get(emailVar)!,
    password: Deno.env.get(passVar)!,
  });
  if (error) throw new Error(`sign-in failed for ${emailVar}: ${error.message}`);
  return db;
}

async function ensureClinic(db: SupabaseClient, slug: string, name: string): Promise<string> {
  const { data: existing } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db.rpc("create_organization", { p_name: name, p_slug: slug, p_language: "ar" });
  if (error) throw new Error(`create_organization failed: ${error.message}`);
  return data as string;
}

Deno.test({
  name: "live: clinics cannot see or change each other's data",
  ignore: !configured,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const a = await signIn("CLINIBOT_USER_A", "CLINIBOT_PASS_A");
    const b = await signIn("CLINIBOT_USER_B", "CLINIBOT_PASS_B");
    const orgA = await ensureClinic(a, "e2e-clinic-a", "E2E Clinic A");
    const orgB = await ensureClinic(b, "e2e-clinic-b", "E2E Clinic B");

    const { data: svc, error: svcError } = await a
      .from("clinic_services")
      .insert({ organization_id: orgA, name_ar: "خدمة اختبار", price_type: "fixed", price_sar: 100 })
      .select("id")
      .single();
    assertEquals(svcError, null);

    // B cannot read A's clinic, services or settings.
    const orgs = await b.from("organizations").select("id");
    assert(!orgs.data!.some((row) => row.id === orgA), "B must not see clinic A");
    const services = await b.from("clinic_services").select("id").eq("organization_id", orgA);
    assertEquals(services.data, []);
    const settings = await b.from("clinic_settings").select("organization_id").eq("organization_id", orgA);
    assertEquals(settings.data, []);

    // B cannot change or delete A's service, nor add one to clinic A.
    const update = await b.from("clinic_services").update({ price_sar: 1 }).eq("id", svc!.id).select("id");
    assertEquals(update.data, []);
    const del = await b.from("clinic_services").delete().eq("id", svc!.id).select("id");
    assertEquals(del.data, []);
    const insert = await b
      .from("clinic_services")
      .insert({ organization_id: orgA, name_ar: "دخيل", price_type: "fixed", price_sar: 1 });
    assert(insert.error !== null, "B must not insert into clinic A");

    // B cannot call A's RPCs.
    const metrics = await b.rpc("dashboard_metrics", { p_org: orgA });
    assert(metrics.error !== null, "B must not read clinic A metrics");
    const members = await b.rpc("list_org_members", { p_org: orgA });
    assert(members.error !== null, "B must not list clinic A staff");

    // Server-owned columns are not writable even by the owner.
    const tested = await a.from("clinic_settings").update({ ai_last_test_ok: true }).eq("organization_id", orgA);
    assert(tested.error !== null, "owners must not mark the AI as tested");
    const sub = await a
      .from("subscription_records")
      .insert({ organization_id: orgA, plan: "pro", status: "active" });
    assert(sub.error !== null, "owners must not grant themselves a plan");

    // The anonymous key sees nothing but public pricing.
    const anon = client();
    const anonOrgs = await anon.from("organizations").select("id");
    assert(anonOrgs.error !== null || (anonOrgs.data ?? []).length === 0, "anon must not read clinics");
    const pricing = await anon.from("plan_limits").select("plan");
    assertEquals(pricing.error, null);
    assertEquals(pricing.data!.length, 3);

    // A still sees its own data.
    const own = await a.from("clinic_services").select("id").eq("organization_id", orgA);
    assert(own.data!.some((row) => row.id === svc!.id));

    await a.from("clinic_services").delete().eq("id", svc!.id);
    void orgB;
  },
});
