import { parseReceiptText, type ParsedReceipt } from './parseReceipt';

/**
 * Text recognition is pluggable.
 *
 * The parser in `parseReceipt.ts` is the valuable half and ships complete and
 * tested. What it needs is raw text, and there is no way to get that from a
 * photo without a native recogniser — Expo ships none, so the app cannot
 * hardcode a dependency it does not have.
 *
 * Instead, a recogniser registers itself at startup. Until one does, the add
 * form simply stays a fast manual form, which is a complete product on its own.
 * See README.md § "تشغيل قراءة الفاتورة تلقائيًا" for the two supported ways to
 * register one: an on-device native module, or an endpoint you control.
 */
export type TextRecognizer = (imageUri: string) => Promise<string>;

let recognizer: TextRecognizer | null = null;

export function registerTextRecognizer(implementation: TextRecognizer): void {
  recognizer = implementation;
}

export function isRecognitionAvailable(): boolean {
  return recognizer !== null;
}

export type RecognitionOutcome =
  | { status: 'unavailable' }
  | { status: 'failed'; reason: string }
  | { status: 'recognized'; parsed: ParsedReceipt; text: string };

/** Reads a receipt photo and returns the fields worth pre-filling. */
export async function readReceipt(imageUri: string): Promise<RecognitionOutcome> {
  if (!recognizer) return { status: 'unavailable' };

  try {
    const text = await recognizer(imageUri);
    if (!text.trim()) return { status: 'failed', reason: 'لم يُقرأ أي نص من الصورة' };
    return { status: 'recognized', parsed: parseReceiptText(text), text };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'تعذّر تحليل الصورة';
    return { status: 'failed', reason };
  }
}
