// «المختصر»: for someone in a hurry, the morning and evening adhkar reported by al-Bukhari or Muslim
// themselves — the most authentic of what is reported — judged from each item's source line.

/** True when the source line starts with al-Bukhari or Muslim as the reporter. */
export function fromSahihayn(source: string): boolean {
  const head = source.trim().replace(/^(أخرجه|رواه|صحيح)\s+/, '');
  return /^(البخاري|مسلم)/.test(head);
}
