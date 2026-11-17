import { adminClient, requireUser } from '../_shared/auth.ts';
import { clamp01, recognize } from '../_shared/claude.ts';
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
    await consumeQuota(admin, user.id, 'recognize');
    const { output, usage } = await recognize(image, body.locale === 'en' ? 'en' : 'ar');
    await recordTokens(admin, user.id, 'recognize', usage);
    // The photo is processed in memory only and never stored by this function.
    return json({ ...output, confidence: clamp01(output.confidence), keywords: output.keywords.slice(0, 8) });
  }),
);
