import { database } from './index';
import type { CategoryId } from '../domain/categories';
import { receiptId, type Receipt, type ReceiptDraft } from '../domain/receipt';

type Row = {
  id: string;
  merchant: string;
  item: string;
  category_id: string;
  total_minor: number;
  purchase_date: string;
  warranty_months: number;
  return_days: number;
  exchange_days: number;
  serial: string;
  notes: string;
  images: string;
  created_at: string;
  updated_at: string;
};

function toReceipt(row: Row): Receipt {
  let images: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.images);
    if (Array.isArray(parsed)) images = parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    // A corrupt images column must not take the whole receipt down with it.
    images = [];
  }

  return {
    id: row.id,
    merchant: row.merchant,
    item: row.item,
    categoryId: row.category_id as CategoryId,
    totalMinor: row.total_minor,
    purchaseDate: row.purchase_date,
    warrantyMonths: row.warranty_months,
    returnDays: row.return_days,
    exchangeDays: row.exchange_days,
    serial: row.serial,
    notes: row.notes,
    images,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM receipts ORDER BY purchase_date DESC, created_at DESC',
  );
  return rows.map(toReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const db = await database();
  const row = await db.getFirstAsync<Row>('SELECT * FROM receipts WHERE id = ?', [id]);
  return row ? toReceipt(row) : null;
}

export async function insertReceipt(draft: ReceiptDraft): Promise<Receipt> {
  const db = await database();
  const now = new Date().toISOString();
  const receipt: Receipt = { ...draft, id: receiptId(), createdAt: now, updatedAt: now };

  await db.runAsync(
    `INSERT INTO receipts (
       id, merchant, item, category_id, total_minor, purchase_date,
       warranty_months, return_days, exchange_days, serial, notes, images,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.id,
      receipt.merchant,
      receipt.item,
      receipt.categoryId,
      receipt.totalMinor,
      receipt.purchaseDate,
      receipt.warrantyMonths,
      receipt.returnDays,
      receipt.exchangeDays,
      receipt.serial,
      receipt.notes,
      JSON.stringify(receipt.images),
      receipt.createdAt,
      receipt.updatedAt,
    ],
  );

  return receipt;
}

export async function updateReceipt(id: string, draft: ReceiptDraft): Promise<Receipt> {
  const db = await database();
  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE receipts SET
       merchant = ?, item = ?, category_id = ?, total_minor = ?, purchase_date = ?,
       warranty_months = ?, return_days = ?, exchange_days = ?, serial = ?, notes = ?,
       images = ?, updated_at = ?
     WHERE id = ?`,
    [
      draft.merchant,
      draft.item,
      draft.categoryId,
      draft.totalMinor,
      draft.purchaseDate,
      draft.warrantyMonths,
      draft.returnDays,
      draft.exchangeDays,
      draft.serial,
      draft.notes,
      JSON.stringify(draft.images),
      updatedAt,
      id,
    ],
  );

  const saved = await getReceipt(id);
  if (!saved) throw new Error(`لم يُعثر على الفاتورة بعد التعديل: ${id}`);
  return saved;
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

export async function deleteAllReceipts(): Promise<void> {
  const db = await database();
  await db.execAsync('DELETE FROM receipts;');
}

/** Reminder bookkeeping, so a rescheduled receipt can cancel its old alerts. */
export type StoredReminder = { id: string; receiptId: string; kind: string; firesAt: string; notificationId: string };

export async function remindersFor(receiptId: string): Promise<StoredReminder[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: string;
    receipt_id: string;
    kind: string;
    fires_at: string;
    notification_id: string;
  }>('SELECT * FROM scheduled_reminders WHERE receipt_id = ?', [receiptId]);

  return rows.map((row) => ({
    id: row.id,
    receiptId: row.receipt_id,
    kind: row.kind,
    firesAt: row.fires_at,
    notificationId: row.notification_id,
  }));
}

export async function replaceReminders(receiptId: string, reminders: Omit<StoredReminder, 'id' | 'receiptId'>[]): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM scheduled_reminders WHERE receipt_id = ?', [receiptId]);
    for (const reminder of reminders) {
      await db.runAsync(
        'INSERT INTO scheduled_reminders (id, receipt_id, kind, fires_at, notification_id) VALUES (?, ?, ?, ?, ?)',
        [`${receiptId}:${reminder.kind}:${reminder.firesAt}`, receiptId, reminder.kind, reminder.firesAt, reminder.notificationId],
      );
    }
  });
}

export async function allReminders(): Promise<StoredReminder[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: string;
    receipt_id: string;
    kind: string;
    fires_at: string;
    notification_id: string;
  }>('SELECT * FROM scheduled_reminders');

  return rows.map((row) => ({
    id: row.id,
    receiptId: row.receipt_id,
    kind: row.kind,
    firesAt: row.fires_at,
    notificationId: row.notification_id,
  }));
}
