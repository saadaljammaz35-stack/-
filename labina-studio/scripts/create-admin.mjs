#!/usr/bin/env node
/**
 * Creates (or promotes) a dashboard user.
 *
 *   npm run admin:create -- owner@example.com "StrongPassword123" "اسم المسؤول" [admin|staff]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or in the environment). The service role key is only used here, on your
 * machine — never in the website itself.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const [email, password, displayName = "", role = "admin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

if (!url || !key) fail("أضف NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY إلى .env.local");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("الاستخدام: npm run admin:create -- email password [name] [admin|staff]");
if (!password || password.length < 10) fail("كلمة المرور يجب أن تكون 10 أحرف على الأقل.");
if (!["admin", "staff"].includes(role)) fail("الدور يجب أن يكون admin أو staff");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  // Already exists → find it and update the password
  const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) fail(error.message);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) fail(created.error.message);
  userId = existing.id;
  const upd = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (upd.error) fail(upd.error.message);
  console.log("• المستخدم موجود مسبقاً، تم تحديث كلمة المرور.");
} else {
  userId = created.data.user.id;
  console.log("• تم إنشاء المستخدم.");
}

const { error: adminError } = await supabase.from("admins").upsert({ user_id: userId, role, display_name: displayName || null });
if (adminError) fail(adminError.message);
console.log(`✔ ${email} أصبح ${role === "admin" ? "مسؤولاً" : "موظفاً"} في لوحة التحكم.`);
