import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ImageKind } from '@/domain/models';
import { newId } from '@/lib/id';

/**
 * Photos are compressed and copied into the app's private document directory.
 * Originals never leave the device unless the user turns on photo backup.
 */
const MAX_STORED = 1600; // px, longest side
const MAX_AI = 1024; // px sent to recognition: enough detail, lower cost

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function render(uri: string, maxSide: number, width: number, height: number) {
  const ctx = ImageManipulator.manipulate(uri);
  const longest = Math.max(width, height);
  if (longest > maxSide) {
    if (width >= height) ctx.resize({ width: maxSide });
    else ctx.resize({ height: maxSide });
  }
  return ctx.renderAsync();
}

export interface StoredPhoto {
  id: string;
  kind: ImageKind;
  localUri: string;
  width: number;
  height: number;
}

/** Compresses a camera/library photo and stores it privately. */
export async function storePhoto(uri: string, kind: ImageKind, size: { width: number; height: number }): Promise<StoredPhoto> {
  const id = newId();
  const image = await render(uri, MAX_STORED, size.width, size.height);
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
  const target = new File(imagesDir(), `${id}.jpg`);
  new File(saved.uri).move(target);
  return { id, kind, localUri: target.uri, width: saved.width, height: saved.height };
}

/** Smaller JPEG as base64 for AI recognition (sent only with the user's consent). */
export async function photoForAi(uri: string, size: { width: number; height: number }): Promise<string> {
  const image = await render(uri, MAX_AI, size.width, size.height);
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('base64 unavailable');
  return saved.base64;
}

/** Stores a background-removed PNG returned by the cutout service. */
export async function storeCutout(pngBase64: string): Promise<StoredPhoto> {
  const id = newId();
  const target = new File(imagesDir(), `${id}.png`);
  target.create();
  target.write(pngBase64, { encoding: 'base64' });
  const info = await ImageManipulator.manipulate(target.uri).renderAsync();
  return { id, kind: 'item_cutout', localUri: target.uri, width: info.width, height: info.height };
}

export async function readBytes(uri: string): Promise<ArrayBuffer> {
  const bytes = await new File(uri).bytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function deleteLocalFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

/** Erases every stored photo (account deletion / erase device). */
export function deleteAllPhotos(): void {
  const dir = new Directory(Paths.document, 'images');
  if (dir.exists) dir.delete();
}
