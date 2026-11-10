import "server-only";
import type { KnowledgeMime } from "@/lib/security/file-sniff";
import { AppError } from "@/lib/http/errors";

export interface Segment {
  text: string;
  page?: number;
}

const MAX_CHARS = 2_000_000;

function cleanText(s: string): string {
  return (
    s
      .normalize("NFC")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/­/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function chatRecordToText(rec: unknown): string | null {
  const r = rec as { messages?: { role?: string; content?: string }[] };
  if (Array.isArray(r?.messages)) {
    return r.messages.map((m) => `${m.role ?? "?"}: ${typeof m.content === "string" ? m.content : ""}`).join("\n");
  }
  return null;
}

function jsonToText(value: unknown, prefix = "", lines: string[] = [], depth = 0): string[] {
  if (depth > 12 || lines.length > 50_000) return lines;
  if (value === null || typeof value !== "object") {
    lines.push(prefix ? `${prefix}: ${String(value)}` : String(value));
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => jsonToText(v, `${prefix}[${i}]`, lines, depth + 1));
  } else {
    for (const [k, v] of Object.entries(value)) jsonToText(v, prefix ? `${prefix}.${k}` : k, lines, depth + 1);
  }
  return lines;
}

/** Extracts plain text segments. PDFs keep page numbers for citations. */
export async function extractText(mime: KnowledgeMime, buf: Uint8Array): Promise<Segment[]> {
  let segments: Segment[];
  switch (mime) {
    case "application/pdf": {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      let pages: string[];
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        pages = (await pdfText(pdf, { mergePages: false })).text as string[];
      } catch (err) {
        throw new AppError("VALIDATION_FAILED", `PDF could not be read: ${(err as Error).message}`);
      }
      segments = pages.map((t, i) => ({ text: cleanText(t), page: i + 1 }));
      if (segments.every((s) => !s.text)) {
        throw new AppError("VALIDATION_FAILED", "PDF has no extractable text (scanned images need OCR first)");
      }
      break;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = (await import("mammoth")).default;
      const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      segments = [{ text: cleanText(r.value) }];
      break;
    }
    case "application/json": {
      const value = JSON.parse(new TextDecoder().decode(buf)) as unknown;
      const chat = Array.isArray(value) ? value.map(chatRecordToText) : [chatRecordToText(value)];
      segments = chat.every((c) => c !== null)
        ? chat.map((c) => ({ text: cleanText(c!) }))
        : [{ text: cleanText(jsonToText(value).join("\n")) }];
      break;
    }
    case "application/x-ndjson": {
      segments = new TextDecoder()
        .decode(buf)
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((l) => {
          const v = JSON.parse(l) as unknown;
          return { text: cleanText(chatRecordToText(v) ?? jsonToText(v).join("\n")) };
        });
      break;
    }
    default:
      segments = [{ text: cleanText(new TextDecoder().decode(buf)) }];
  }
  segments = segments.filter((s) => s.text.length > 0);
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  if (total === 0) throw new AppError("VALIDATION_FAILED", "The file contains no text");
  if (total > MAX_CHARS) throw new AppError("PAYLOAD_TOO_LARGE", `Extracted text exceeds ${MAX_CHARS} characters`);
  return segments;
}
