import type { ChatMessage } from "./providers/types";

// Conservative token estimate used ONLY for context budgeting before a call
// and as a labelled fallback when a provider reports no usage. It is tuned to
// over-estimate (safer for budgets) across Arabic and English: Arabic script
// tokenises into more tokens per character than Latin text in BPE
// vocabularies trained mostly on English.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let arabic = 0;
  let latin = 0;
  let digits = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) || (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) arabic++;
    else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) latin++;
    else if (cp >= 0x30 && cp <= 0x39) digits++;
    else if (cp !== 0x20) other++;
  }
  return Math.ceil(latin / 3.5 + arabic / 2.2 + digits / 1.5 + other / 1.2);
}

/** Chat templates add a few tokens per message for role markers. */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 6, 3);
}
