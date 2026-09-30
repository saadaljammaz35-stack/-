import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { CATEGORIES, type CategoryId } from '../domain/categories';
import { DEFAULT_EXCHANGE_DAYS, DEFAULT_RETURN_DAYS, type Receipt, type ReceiptDraft } from '../domain/receipt';
import { insertReceipt, listReceipts } from '../db/receipts';
import { imageAsDataUri, imageFile } from './files';

const FORMAT_VERSION = 1;
const CATEGORY_IDS = new Set<string>(CATEGORIES.map((entry) => entry.id));

type BackupImage = { name: string; base64: string };

type BackupFile = {
  format: 'damaan-backup';
  version: number;
  exportedAt: string;
  receipts: Receipt[];
  images: BackupImage[];
};

/**
 * Writes every receipt and its images into one JSON file and opens the share
 * sheet. Images are embedded so the backup is genuinely self-contained — a
 * metadata-only export would restore rows with no proof attached, which is the
 * one thing this app exists to keep.
 */
export async function exportBackup(): Promise<{ receipts: number; bytes: number }> {
  const receipts = await listReceipts();

  const images: BackupImage[] = [];
  for (const receipt of receipts) {
    for (const name of receipt.images) {
      const dataUri = await imageAsDataUri(name);
      if (dataUri) images.push({ name, base64: dataUri.slice(dataUri.indexOf(',') + 1) });
    }
  }

  const payload: BackupFile = {
    format: 'damaan-backup',
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    receipts,
    images,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `damaan-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'نسخة ضَمان الاحتياطية' });
  }

  return { receipts: receipts.length, bytes: file.size ?? 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validates one row from a backup, filling anything missing with a sane value. */
function toDraft(raw: unknown): ReceiptDraft | null {
  if (!isRecord(raw)) return null;

  const merchant = typeof raw.merchant === 'string' ? raw.merchant : '';
  const purchaseDate = typeof raw.purchaseDate === 'string' ? raw.purchaseDate : '';
  if (!merchant || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return null;

  const categoryId = typeof raw.categoryId === 'string' && CATEGORY_IDS.has(raw.categoryId)
    ? (raw.categoryId as CategoryId)
    : 'other';

  const asCount = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

  return {
    merchant,
    item: typeof raw.item === 'string' ? raw.item : '',
    categoryId,
    totalMinor: asCount(raw.totalMinor, 0),
    purchaseDate,
    warrantyMonths: asCount(raw.warrantyMonths, 0),
    returnDays: asCount(raw.returnDays, DEFAULT_RETURN_DAYS),
    exchangeDays: asCount(raw.exchangeDays, DEFAULT_EXCHANGE_DAYS),
    serial: typeof raw.serial === 'string' ? raw.serial : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    images: Array.isArray(raw.images) ? raw.images.filter((entry): entry is string => typeof entry === 'string') : [],
  };
}

export type ImportOutcome =
  | { status: 'cancelled' }
  | { status: 'invalid'; reason: string }
  | { status: 'imported'; receipts: number; skipped: number };

/**
 * Restores a backup **alongside** whatever is already stored — importing never
 * erases, so a mistaken import costs a few duplicates rather than a whole
 * archive. Rows are added with fresh ids for the same reason.
 */
export async function importBackup(): Promise<ImportOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };

  let payload: unknown;
  try {
    payload = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    return { status: 'invalid', reason: 'الملف غير قابل للقراءة' };
  }

  if (!isRecord(payload) || payload.format !== 'damaan-backup') {
    return { status: 'invalid', reason: 'هذا الملف ليس نسخة احتياطية من ضَمان' };
  }
  if (typeof payload.version !== 'number' || payload.version > FORMAT_VERSION) {
    return { status: 'invalid', reason: 'النسخة أحدث من هذا الإصدار من التطبيق' };
  }
  if (!Array.isArray(payload.receipts)) {
    return { status: 'invalid', reason: 'لا توجد فواتير في هذا الملف' };
  }

  // Restore images first so the rows that reference them are never orphaned.
  const directory = new Directory(Paths.document, 'receipts');
  if (!directory.exists) directory.create({ intermediates: true });

  if (Array.isArray(payload.images)) {
    for (const entry of payload.images) {
      if (!isRecord(entry) || typeof entry.name !== 'string' || typeof entry.base64 !== 'string') continue;
      const target = imageFile(entry.name);
      if (target.exists) continue;
      target.create();
      target.write(entry.base64, { encoding: 'base64' });
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const raw of payload.receipts) {
    const draft = toDraft(raw);
    if (!draft) {
      skipped += 1;
      continue;
    }
    // Drop references to images the backup did not carry.
    draft.images = draft.images.filter((name) => imageFile(name).exists);
    await insertReceipt(draft);
    imported += 1;
  }

  return { status: 'imported', receipts: imported, skipped };
}
