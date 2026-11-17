import { adminClient, requireUser } from '../_shared/auth.ts';
import { clamp01, detect } from '../_shared/claude.ts';
import { handler, json, readJson } from '../_shared/http.ts';
import { parseImage } from '../_shared/image.ts';
import { consumeQuota, recordTokens, requireAiConsent } from '../_shared/policy.ts';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const admin = adminClient();
    await requireAiConsent(admin, user.id);
    const body = await readJson<{ image?: string; media_type?: string; locale?: string }>(req);
    const image = parseImage(body);
    await consumeQuota(admin, user.id, 'detect');
    const { output, usage } = await detect(image, body.locale === 'en' ? 'en' : 'ar');
    await recordTokens(admin, user.id, 'detect', usage);
    const items = output.items.slice(0, 20).map((i) => ({
      ...i,
      confidence: clamp01(i.confidence),
      box: i.box ? { x: clamp01(i.box.x), y: clamp01(i.box.y), w: clamp01(i.box.w), h: clamp01(i.box.h) } : null,
    }));
    return json({ items });
  }),
);
