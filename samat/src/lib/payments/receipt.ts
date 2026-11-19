/** Detect the real file type from its first bytes (never trust the browser's MIME or extension). */
export function sniffReceipt(buf: Uint8Array): { mime: string; ext: string } | null {
  const b = (i: number) => buf[i];
  const ascii = (from: number, len: number) => String.fromCharCode(...buf.slice(from, from + len));
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b(0) === 0x89 && ascii(1, 3) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii(0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (ascii(4, 4) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(ascii(8, 4))) return { mime: 'image/heic', ext: 'heic' };
  return null;
}

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
