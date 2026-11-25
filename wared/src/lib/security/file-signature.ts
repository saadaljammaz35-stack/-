/** Detects a file's real type from its first bytes, so a renamed file cannot pass as an image or audio. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1;
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(start, start + length)));

  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'audio/wav';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg';
  if (b(0) === 0xff && (b(1) & 0xe0) === 0xe0 && (b(1) & 0x06) !== 0) {
    // MPEG audio frame sync (layer bits must not be 00). ADTS AAC uses layer 00.
    return 'audio/mpeg';
  }
  if (b(0) === 0xff && (b(1) & 0xf6) === 0xf0) return 'audio/aac';
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return 'video/webm';
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand.startsWith('m4a') || brand === 'm4b ' || brand === 'f4a ') return 'audio/mp4';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  return null;
}

const COMPATIBLE: Record<string, string[]> = {
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/webp': ['image/webp'],
  'image/avif': ['image/avif'],
  'audio/mpeg': ['audio/mpeg'],
  'audio/mp4': ['audio/mp4', 'video/mp4'],
  'audio/x-m4a': ['audio/mp4', 'video/mp4'],
  'audio/aac': ['audio/aac'],
  'audio/ogg': ['audio/ogg'],
  'audio/wav': ['audio/wav'],
  'video/mp4': ['video/mp4', 'audio/mp4'],
  'video/webm': ['video/webm'],
  'video/quicktime': ['video/quicktime', 'video/mp4'],
};

export function signatureMatches(declaredMime: string, bytes: Uint8Array): boolean {
  const sniffed = sniffMime(bytes);
  if (!sniffed) return false;
  return (COMPATIBLE[declaredMime] ?? []).includes(sniffed);
}
