import { redactText } from "@/lib/security/redact";

// Output validation. Two jobs:
//   * citations may only reference sources that were actually provided;
//   * secret-shaped strings are masked.
// The streaming sanitiser applies the same rules incrementally. It holds back
// the tail of the text and only releases up to the last whitespace before the
// hold-back window, so a key or a citation can never be split across the
// boundary and slip through half-checked.

const CITATION = /\[S(\d{1,2})\]/g;

export function cleanCitations(text: string, allowed: ReadonlySet<string>): string {
  return text.replace(CITATION, (m, n: string) => (allowed.has(`S${n}`) ? m : ""));
}

export function citedSources(text: string, allowed: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CITATION)) if (allowed.has(`S${m[1]}`)) out.add(`S${m[1]}`);
  return [...out];
}

export function validateOutput(text: string, allowed: ReadonlySet<string>): { text: string; cited: string[] } {
  const clean = redactText(cleanCitations(text, allowed));
  return { text: clean, cited: citedSources(clean, allowed) };
}

export class StreamSanitizer {
  private pending = "";
  private emitted = "";
  /**
   * Text is only ever released up to a whitespace boundary, so a single
   * token (an API key, a JWT, a citation like [S3]) is never split and is
   * always checked whole. The hold-back only has to cover patterns that
   * contain spaces (grouped card numbers, "Bearer <token>"); private-key
   * blocks are held from BEGIN until their END marker arrives.
   */
  constructor(
    private readonly allowed: ReadonlySet<string>,
    private readonly holdBack = 32,
  ) {}

  /** Feed raw model text; returns sanitised text safe to send now. */
  push(delta: string): string {
    this.pending += delta;
    const limit = this.pending.length - this.holdBack;
    if (limit <= 0) return "";
    let cut = Math.max(this.pending.lastIndexOf(" ", limit), this.pending.lastIndexOf("\n", limit));
    // Never cut inside a private-key block: release it whole (so the PEM
    // pattern can mask it) or hold everything from its BEGIN marker.
    const pem = this.pending.indexOf("-----BEGIN");
    if (pem >= 0) {
      const end = /-----END [A-Z ]*-----/.exec(this.pending.slice(pem));
      if (!end) {
        if (cut >= pem) cut = pem - 1;
      } else {
        const endIdx = pem + end.index + end[0].length;
        if (cut >= pem && cut < endIdx) cut = endIdx - 1;
      }
    }
    if (cut < 0) return "";
    const ready = this.pending.slice(0, cut + 1);
    this.pending = this.pending.slice(cut + 1);
    const out = redactText(cleanCitations(ready, this.allowed));
    this.emitted += out;
    return out;
  }

  /** Flush the remainder at the end of the stream. */
  flush(): string {
    const out = redactText(cleanCitations(this.pending, this.allowed));
    this.pending = "";
    this.emitted += out;
    return out;
  }

  get text(): string {
    return this.emitted;
  }
}
