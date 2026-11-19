/**
 * ZATCA (Saudi e-invoicing) phase-1 QR payload for simplified tax invoices: TLV fields
 * 1 seller name · 2 VAT number · 3 timestamp · 4 total incl. VAT · 5 VAT amount, base64-encoded.
 * Phase 2 (integration with the FATOORA platform, cryptographic stamp) needs the restaurant's
 * ZATCA onboarding and is not covered here.
 */
export function zatcaTlvBase64(f: { sellerName: string; vatNumber: string; timestamp: Date; total: number; vat: number }): string {
  const fields = [
    f.sellerName,
    f.vatNumber,
    f.timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    (f.total / 100).toFixed(2),
    (f.vat / 100).toFixed(2),
  ];
  const parts: Buffer[] = [];
  fields.forEach((value, i) => {
    const bytes = Buffer.from(value, 'utf8');
    if (bytes.length > 255) throw new Error(`ZATCA field ${i + 1} too long`);
    parts.push(Buffer.from([i + 1, bytes.length]), bytes);
  });
  return Buffer.concat(parts).toString('base64');
}

export function decodeTlv(b64: string): Record<number, string> {
  const buf = Buffer.from(b64, 'base64');
  const out: Record<number, string> = {};
  let i = 0;
  while (i < buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    out[tag] = buf.subarray(i + 2, i + 2 + len).toString('utf8');
    i += 2 + len;
  }
  return out;
}
