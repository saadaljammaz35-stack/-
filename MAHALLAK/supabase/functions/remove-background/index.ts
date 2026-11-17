import { adminClient, requireUser } from '../_shared/auth.ts';
import { HttpError, handler, json, readJson } from '../_shared/http.ts';
import { base64ToBytes, bytesToBase64, parseImage } from '../_shared/image.ts';
import { consumeQuota, requireAiConsent } from '../_shared/policy.ts';

/**
 * Background removal through a configurable provider. Returns 501 when no
 * provider is configured; the app then simply keeps the original photo.
 *   BG_REMOVAL_PROVIDER = photoroom | removebg
 *   BG_REMOVAL_API_KEY  = provider key (secret)
 */
async function callProvider(provider: string, key: string, image: { data: string; mediaType: string }): Promise<Uint8Array> {
  const form = new FormData();
  const blob = new Blob([base64ToBytes(image.data)], { type: image.mediaType });
  if (provider === 'photoroom') {
    form.append('image_file', blob, 'item.jpg');
    form.append('format', 'png');
    const res = await fetch('https://sdk.photoroom.com/v1/segment', { method: 'POST', headers: { 'x-api-key': key }, body: form });
    if (!res.ok) throw new HttpError(502, 'cutout_failed');
    return new Uint8Array(await res.arrayBuffer());
  }
  if (provider === 'removebg') {
    form.append('image_file', blob, 'item.jpg');
    form.append('size', 'auto');
    form.append('format', 'png');
    const res = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': key }, body: form });
    if (!res.ok) throw new HttpError(502, 'cutout_failed');
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new HttpError(501, 'cutout_not_configured');
}

Deno.serve(
  handler(async (req) => {
    const user = await requireUser(req);
    const admin = adminClient();
    await requireAiConsent(admin, user.id);
    const provider = Deno.env.get('BG_REMOVAL_PROVIDER') ?? '';
    const key = Deno.env.get('BG_REMOVAL_API_KEY') ?? '';
    if (!provider || !key) throw new HttpError(501, 'cutout_not_configured');
    const image = parseImage(await readJson(req));
    await consumeQuota(admin, user.id, 'cutout');
    const png = await callProvider(provider, key, image);
    if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) throw new HttpError(502, 'cutout_failed');
    return json({ image_png_base64: bytesToBase64(png) });
  }),
);
