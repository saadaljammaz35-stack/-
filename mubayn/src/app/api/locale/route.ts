import { cookies } from "next/headers";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";

export const POST = route("locale", async (req) => {
  const { locale } = await readJson(req, z.object({ locale: z.enum(["ar", "en"]) }));
  (await cookies()).set("lang", locale, { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600 });
  const s = await currentSession();
  if (s) await query(`UPDATE users SET locale = $2 WHERE id = $1`, [s.user.id, locale]);
  return json({ ok: true });
});
