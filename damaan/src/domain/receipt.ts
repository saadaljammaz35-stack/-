import type { CategoryId } from './categories';

/**
 * One purchase, with everything needed to prove it later: the paper trail
 * (images), the money, and the three clocks that start on the purchase date.
 */
export type Receipt = {
  id: string;
  /** Where it was bought — appears on the claim letter. */
  merchant: string;
  /** What was bought. */
  item: string;
  categoryId: CategoryId;
  /** Halalas. See domain/money.ts. */
  totalMinor: number;
  /** `yyyy-mm-dd`. Every deadline counts from this day. */
  purchaseDate: string;
  /** Manufacturer warranty length in months. 0 means none. */
  warrantyMonths: number;
  /** The seller's refund window, in days from purchase. */
  returnDays: number;
  /** The seller's exchange window, in days from purchase. */
  exchangeDays: number;
  serial: string;
  notes: string;
  /** File names inside the app's receipts directory, oldest first. */
  images: string[];
  createdAt: string;
  updatedAt: string;
};

export type ReceiptDraft = Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Policy windows vary by seller, so these are only the values the add form
 * starts from. Both are editable per receipt and in Settings.
 */
export const DEFAULT_RETURN_DAYS = 14;
export const DEFAULT_EXCHANGE_DAYS = 7;

export function receiptId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `rcp_${Date.now().toString(36)}${random}`;
}
