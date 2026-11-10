import { estimateTokens } from "../tokens";
import type { Segment } from "./extract";

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  metadata: { page?: number; heading?: string };
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
  maxChars?: number;
}

/** Sentence split that understands Arabic punctuation (؟ ۔ ،) as well as Latin. */
export function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?؟۔])\s+|\n+/u);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Packs sentences into chunks of ~targetTokens with a sentence-level overlap,
 * never crossing a page boundary (so a citation can name its page) and
 * carrying the nearest Markdown heading as context.
 */
export function chunkSegments(segments: Segment[], opts: ChunkOptions = {}): Chunk[] {
  const target = opts.targetTokens ?? 350;
  const overlap = opts.overlapTokens ?? 60;
  const maxChars = opts.maxChars ?? 6000;
  const chunks: Chunk[] = [];
  let heading: string | undefined;

  for (const seg of segments) {
    let buf: string[] = [];
    let bufTokens = 0;
    const flush = () => {
      if (!buf.length) return;
      const content = buf.join(" ").trim();
      if (content) {
        chunks.push({
          index: chunks.length,
          content,
          tokenCount: estimateTokens(content),
          metadata: { ...(seg.page ? { page: seg.page } : {}), ...(heading ? { heading } : {}) },
        });
      }
      // Overlap: carry trailing sentences worth ~overlap tokens into the next chunk.
      const carry: string[] = [];
      let carryTokens = 0;
      for (let i = buf.length - 1; i >= 0 && carryTokens < overlap; i--) {
        carry.unshift(buf[i]!);
        carryTokens += estimateTokens(buf[i]!);
      }
      buf = carryTokens < bufTokens ? carry : [];
      bufTokens = buf.reduce((n, s) => n + estimateTokens(s), 0);
    };

    for (const line of seg.text.split("\n")) {
      const h = /^#{1,6}\s+(.+)$/.exec(line.trim());
      if (h) {
        flush();
        buf = [];
        bufTokens = 0;
        heading = h[1]!.slice(0, 200);
        continue;
      }
      for (let sentence of splitSentences(line)) {
        // A single enormous "sentence" (minified text, tables) is hard-wrapped.
        while (sentence.length > maxChars) {
          buf.push(sentence.slice(0, maxChars));
          bufTokens += estimateTokens(sentence.slice(0, maxChars));
          sentence = sentence.slice(maxChars);
          flush();
        }
        const t = estimateTokens(sentence);
        if (bufTokens + t > target && bufTokens > 0) flush();
        buf.push(sentence);
        bufTokens += t;
      }
    }
    flush();
  }
  // Drop chunks that are pure overlap duplicates of their predecessor.
  return chunks
    .filter((c, i) => i === 0 || c.content !== chunks[i - 1]!.content)
    .map((c, i) => ({ ...c, index: i }));
}
