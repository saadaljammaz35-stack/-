import { Directory, File, Paths } from 'expo-file-system';

/**
 * Receipt images live in the app's document directory, which iOS does not
 * reclaim under storage pressure — a receipt the system deleted would defeat
 * the whole product. Only the file name is stored in SQLite; the container
 * path changes between installs, so a stored absolute URI would go stale.
 */
const FOLDER = 'receipts';

function receiptsDirectory(): Directory {
  const directory = new Directory(Paths.document, FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function imageFile(name: string): File {
  return new File(receiptsDirectory(), name);
}

/** Resolves a stored name to a URI an <Image> can render. */
export function imageUri(name: string): string {
  return imageFile(name).uri;
}

function extensionOf(uri: string): string {
  const match = /\.(jpe?g|png|heic|webp)(?:\?|$)/i.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

/**
 * Copies a picked or captured image into permanent storage and returns the
 * name to persist. The picker hands back a cache URI that is cleared later.
 */
export async function importImage(sourceUri: string): Promise<string> {
  const directory = receiptsDirectory();
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extensionOf(sourceUri)}`;
  const destination = new File(directory, name);
  await new File(sourceUri).copy(destination);
  return name;
}

export function deleteImage(name: string): void {
  const file = imageFile(name);
  if (file.exists) file.delete();
}

/** Data URI for embedding an image in the claim PDF's HTML. */
export async function imageAsDataUri(name: string): Promise<string | null> {
  const file = imageFile(name);
  if (!file.exists) return null;

  const extension = extensionOf(name);
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${await file.base64()}`;
}

/** Total bytes held by receipt images, for the Settings storage row. */
export function imagesSize(): number {
  const directory = new Directory(Paths.document, FOLDER);
  if (!directory.exists) return 0;

  let total = 0;
  for (const entry of directory.list()) {
    if (entry instanceof File) total += entry.size ?? 0;
  }
  return total;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

/** Removes every stored image. Used by the erase-all path. */
export function deleteAllImages(): void {
  const directory = new Directory(Paths.document, FOLDER);
  if (directory.exists) directory.delete();
}
