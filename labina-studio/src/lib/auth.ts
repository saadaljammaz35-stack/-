import "server-only";
import { cache } from "react";
import { getServerClient } from "./supabase/server";
import type { ActionResult } from "./types";

export type StaffRole = "admin" | "staff";

export type StaffContext = {
  userId: string;
  email: string;
  role: StaffRole | null;
  displayName: string;
};

/** The signed-in user and their studio role (null role = signed in without access) */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("admins").select("role, display_name").eq("user_id", user.id).maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? "",
    role: (data?.role as StaffRole | undefined) ?? null,
    displayName: data?.display_name || user.email?.split("@")[0] || "مسؤول",
  };
});

type Authorized = {
  ok: true;
  supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>;
  ctx: StaffContext;
};
type Denied = { ok: false; result: ActionResult<never> };

/** Used at the top of every admin server action */
export async function authorize(level: StaffRole = "staff"): Promise<Authorized | Denied> {
  const supabase = await getServerClient();
  if (!supabase) return { ok: false, result: { ok: false, error: "لم يتم ربط قاعدة البيانات بعد." } };
  const ctx = await getStaffContext();
  if (!ctx) return { ok: false, result: { ok: false, error: "انتهت الجلسة. سجّل الدخول مرة أخرى." } };
  if (!ctx.role || (level === "admin" && ctx.role !== "admin")) {
    return { ok: false, result: { ok: false, error: "ليست لديك صلاحية لهذا الإجراء." } };
  }
  return { ok: true, supabase, ctx };
}
