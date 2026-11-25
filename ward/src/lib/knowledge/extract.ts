import { badRequest } from '@/lib/http';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type FileKind = 'pdf' | 'docx' | 'text' | 'image';

/** Identify by magic bytes, not by the client-supplied name or MIME type. */
export function sniff(data: Uint8Array, name: string): { kind: FileKind; mime: string } {
  const head = Array.from(data.subarray(0, 12));
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return { kind: 'pdf', mime: 'application/pdf' };
  if (starts([0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mime: 'image/png' };
  if (starts([0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg' };
  if (starts([0x52, 0x49, 0x46, 0x46]) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return { kind: 'image', mime: 'image/webp' };
  }
  if (starts([0x50, 0x4b, 0x03, 0x04]) && /\.docx$/i.test(name)) {
    return { kind: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  if (/\.(txt|md|csv)$/i.test(name)) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data.subarray(0, 4096));
    // Reject binaries renamed to .txt: no NUL bytes allowed.
    if (!text.includes('\u0000')) return { kind: 'text', mime: 'text/plain; charset=utf-8' };
  }
  throw badRequest('unsupported_file_type', 'unsupported_file_type: supported types are PDF, DOCX, TXT/MD/CSV, PNG, JPEG, WEBP');
}

export async function extractText(kind: FileKind, data: Uint8Array): Promise<string> {
  switch (kind) {
    case 'pdf': {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
      const doc = await getDocumentProxy(new Uint8Array(data));
      const { text } = await pdfText(doc, { mergePages: true });
      return (Array.isArray(text) ? text.join('\n\n') : text).trim();
    }
    case 'docx': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
      return result.value.trim();
    }
    case 'text':
      return new TextDecoder('utf-8').decode(data).trim();
    case 'image':
      // No OCR is claimed: the founder supplies a description that becomes the searchable text.
      return '';
  }
}
