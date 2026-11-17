import type { ImageKind } from '@/domain/models';
import { newId } from '@/lib/id';

/** Web preview: photos stay as data/blob URLs in the browser session. */
export interface StoredPhoto {
  id: string;
  kind: ImageKind;
  localUri: string;
  width: number;
  height: number;
}

async function toDataUrl(uri: string, maxSide: number, quality: number): Promise<{ url: string; width: number; height: number }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = uri;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height };
}

export async function storePhoto(uri: string, kind: ImageKind): Promise<StoredPhoto> {
  const r = await toDataUrl(uri, 1200, 0.72);
  return { id: newId(), kind, localUri: r.url, width: r.width, height: r.height };
}

export async function photoForAi(uri: string): Promise<string> {
  const r = await toDataUrl(uri, 1024, 0.7);
  return r.url.split(',')[1] ?? '';
}

export async function storeCutout(pngBase64: string): Promise<StoredPhoto> {
  return { id: newId(), kind: 'item_cutout', localUri: `data:image/png;base64,${pngBase64}`, width: 0, height: 0 };
}

export async function readBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}

export function deleteLocalFile(): void {}
export function deleteAllPhotos(): void {}
