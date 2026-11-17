import { HttpError } from './http.ts';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageInput {
  data: string;
  mediaType: 'image/jpeg' | 'image/png';
}

/** Validates a base64 photo: allowed type, real image signature, bounded size. */
export function parseImage(body: { image?: unknown; media_type?: unknown }): ImageInput {
  if (typeof body.image !== 'string' || body.image.length < 100) throw new HttpError(400, 'image_required');
  const data = body.image.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new HttpError(400, 'invalid_image');
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) throw new HttpError(413, 'image_too_large');
  const head = atob(data.slice(0, 16));
  const isJpeg = head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8;
  const isPng = head.startsWith('\x89PNG');
  if (!isJpeg && !isPng) throw new HttpError(400, 'invalid_image');
  return { data, mediaType: isPng ? 'image/png' : 'image/jpeg' };
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
