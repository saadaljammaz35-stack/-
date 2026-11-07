import { resendVerification } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const POST = route("auth.resend", async () => {
  const s = await requireUser();
  await resendVerification(s.user.id);
  return json({ ok: true });
});
