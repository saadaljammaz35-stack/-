// Identifies uploaded files by their content, never by the client-supplied
// name or Content-Type. Anything that is not one of the supported formats is
// rejected.

export type KnowledgeMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"
  | "application/json"
  | "application/x-ndjson";

export const SUPPORTED_EXTENSIONS: Record<string, KnowledgeMime> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  jsonl: "application/x-ndjson",
  ndjson: "application/x-ndjson",
};

function startsWith(buf: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => buf[i] === b);
}

/** Minimal ZIP central-directory scan: is this an OOXML Word document? */
function isDocx(buf: Uint8Array): boolean {
  if (!startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return false;
  const text = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("latin1");
  return text.includes("[Content_Types].xml") && text.includes("word/document.xml");
}

function isUtf8Text(buf: Uint8Array): boolean {
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    // Reject binary masquerading as text: control characters other than tab/newline/CR/form-feed.
    return !/[\u0000-\u0008\u000E-\u001F\u007F]/.test(s.slice(0, 65536));
  } catch {
    return false;
  }
}

export interface SniffResult {
  ok: boolean;
  mime?: KnowledgeMime;
  reason?: string;
}

/**
 * The extension chooses between text dialects (txt/md/json/jsonl) only after
 * the content has been confirmed to be text; for binary formats the magic
 * bytes must match the extension.
 */
export function sniffKnowledgeFile(filename: string, buf: Uint8Array): SniffResult {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const claimed = SUPPORTED_EXTENSIONS[ext];
  if (!claimed) return { ok: false, reason: `Unsupported file type .${ext}` };
  if (buf.byteLength === 0) return { ok: false, reason: "File is empty" };

  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return claimed === "application/pdf" ? { ok: true, mime: claimed } : { ok: false, reason: "File content is PDF but extension is not .pdf" };
  }
  if (isDocx(buf)) {
    return claimed === SUPPORTED_EXTENSIONS.docx ? { ok: true, mime: claimed } : { ok: false, reason: "File content is DOCX but extension does not match" };
  }
  if (claimed === "application/pdf" || claimed === SUPPORTED_EXTENSIONS.docx) {
    return { ok: false, reason: "File content does not match its extension" };
  }
  if (!isUtf8Text(buf)) return { ok: false, reason: "Text files must be valid UTF-8" };
  const text = new TextDecoder().decode(buf);
  if (claimed === "application/json") {
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, reason: "Invalid JSON" };
    }
  }
  if (claimed === "application/x-ndjson") {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      try {
        JSON.parse(lines[i]!);
      } catch {
        return { ok: false, reason: `Invalid JSON on line ${i + 1}` };
      }
    }
  }
  return { ok: true, mime: claimed };
}

/** Strips path components and control characters from a client filename. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").trim();
  return (base || "file").slice(0, 200);
}
