import { exportAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const GET = route("account.export", async () => {
  const s = await requireUser();
  await rateLimit(`export:${s.user.id}`, 10, 3600);
  const data = await exportAccount(s.user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mubayn-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
