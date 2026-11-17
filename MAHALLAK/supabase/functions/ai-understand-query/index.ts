import { adminClient, requireUser } from '../_shared/auth.ts';
import { understand } from '../_shared/claude.ts';
import { HttpError, handler, json, readJson } from '../_shared/http.ts';
import { consumeQuota, recordTokens, requireAiConsent } from '../_shared/policy.ts';

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const admin = adminClient();
    await requireAiConsent(admin, user.id);
    const body = await readJson<{ text?: string }>(req, 16 * 1024);
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 300) : '';
    if (!text) throw new HttpError(400, 'text_required');
    await consumeQuota(admin, user.id, 'query');
    const { output, usage } = await understand(text);
    await recordTokens(admin, user.id, 'query', usage);
    return json(output);
  }),
);
