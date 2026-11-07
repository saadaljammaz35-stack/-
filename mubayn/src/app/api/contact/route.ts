import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(10).max(5000),
});

export const POST = route("contact", async (req) => {
  await rateLimit(`contact:ip:${clientIp(req) ?? "unknown"}`, 5, 3600);
  const body = await readJson(req, schema);
  const s = await currentSession();
  await query(`INSERT INTO contact_messages (user_id, name, email, subject, message) VALUES ($1,$2,$3,$4,$5)`, [s?.user.id ?? null, body.name, body.email, body.subject, body.message]);
  return json({ ok: true }, 201);
});
