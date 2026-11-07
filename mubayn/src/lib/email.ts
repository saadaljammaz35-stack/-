import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { query } from "./db";
import { log, redactSecrets } from "./errors";

/**
 * Transactional e-mail. Production uses Resend's HTTPS API. The "console"
 * driver (development only, refused in production by config.ts) prints the
 * message and writes it to .storage/mail so local tests can follow links.
 */

type Locale = "ar" | "en";

export type Template =
  | { name: "verify_email"; link: string }
  | { name: "reset_password"; link: string }
  | { name: "account_exists"; loginLink: string; resetLink: string }
  | { name: "account_deleted" };

function render(t: Template, locale: Locale): { subject: string; text: string } {
  const ar = locale === "ar";
  const sign = ar ? "\n\n— فريق مُبيِّن" : "\n\n— The MUBAYN team";
  switch (t.name) {
    case "verify_email":
      return ar
        ? { subject: "أكّد بريدك الإلكتروني في مُبيِّن", text: `مرحباً،\n\nلتأكيد بريدك افتح الرابط التالي (صالح لمدة 24 ساعة):\n${t.link}\n\nإذا لم تنشئ حساباً فتجاهل هذه الرسالة.${sign}` }
        : { subject: "Confirm your e-mail for MUBAYN", text: `Hello,\n\nConfirm your e-mail by opening this link (valid for 24 hours):\n${t.link}\n\nIf you did not create an account, ignore this message.${sign}` };
    case "reset_password":
      return ar
        ? { subject: "إعادة تعيين كلمة المرور", text: `طلبت إعادة تعيين كلمة المرور. افتح الرابط التالي خلال ساعة:\n${t.link}\n\nإذا لم تطلب ذلك فتجاهل الرسالة، ولن يتغير شيء.${sign}` }
        : { subject: "Reset your password", text: `You asked to reset your password. Open this link within one hour:\n${t.link}\n\nIf this was not you, ignore this message and nothing will change.${sign}` };
    case "account_exists":
      return ar
        ? { subject: "لديك حساب بالفعل", text: `حاول أحدهم إنشاء حساب بهذا البريد، لكن لديك حساب مسبقاً.\nتسجيل الدخول: ${t.loginLink}\nنسيت كلمة المرور؟ ${t.resetLink}${sign}` }
        : { subject: "You already have an account", text: `Someone tried to sign up with this e-mail, but you already have an account.\nSign in: ${t.loginLink}\nForgot your password? ${t.resetLink}${sign}` };
    case "account_deleted":
      return ar
        ? { subject: "تم حذف حسابك", text: `حُذف حسابك وكل الأدلة والتقارير المرتبطة به نهائياً.${sign}` }
        : { subject: "Your account was deleted", text: `Your account and all of its evidence and reports were permanently deleted.${sign}` };
  }
}

export async function sendEmail(to: string, t: Template, locale: Locale, userId: string | null = null): Promise<boolean> {
  const c = config();
  // Deliberately no e-mail on this deployment: nothing is sent or logged.
  if (c.EMAIL_DRIVER === "none") return false;
  const { subject, text } = render(t, locale);
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    if (c.EMAIL_DRIVER === "resend") {
      if (!c.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${c.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: c.EMAIL_FROM, to: [to], subject, text, reply_to: c.SUPPORT_EMAIL }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? "error"}`);
      providerId = body.id ?? null;
    } else {
      const dir = path.resolve(c.LOCAL_STORAGE_DIR, "mail");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${t.name}-${Math.random().toString(36).slice(2, 8)}.json`);
      await writeFile(file, JSON.stringify({ to, subject, text, template: t }, null, 2));
      log("info", "[DEV e-mail — not delivered]", { to, subject });
      providerId = path.basename(file);
    }
  } catch (e) {
    error = redactSecrets(e instanceof Error ? e.message : String(e));
    log("error", "email send failed", { to, template: t.name, error });
  }
  await query(
    `INSERT INTO email_log (user_id, to_address, template, provider, provider_id, status, error) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, to, t.name, c.EMAIL_DRIVER, providerId, error ? "failed" : "sent", error],
  ).catch(() => undefined);
  return !error;
}
