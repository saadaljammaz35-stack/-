import { describe, expect, it } from 'vitest';
import { signatureMatches, sniffMime } from '@/lib/security/file-signature';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe('sniffMime', () => {
  it('recognises the allowed formats from their magic bytes', () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMime(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('image/png');
    expect(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
    expect(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe('audio/wav');
    expect(sniffMime(bytes('ID3', 4, 0))).toBe('audio/mpeg');
    expect(sniffMime(bytes(0xff, 0xfb, 0x90, 0x00))).toBe('audio/mpeg');
    expect(sniffMime(bytes(0xff, 0xf1, 0x50, 0x80))).toBe('audio/aac');
    expect(sniffMime(bytes('OggS', 0))).toBe('audio/ogg');
    expect(sniffMime(bytes(0, 0, 0, 0x20, 'ftyp', 'M4A '))).toBe('audio/mp4');
    expect(sniffMime(bytes(0, 0, 0, 0x20, 'ftyp', 'isom'))).toBe('video/mp4');
    expect(sniffMime(bytes(0, 0, 0, 0x20, 'ftyp', 'avif'))).toBe('image/avif');
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
  });

  it('rejects files whose content does not match the declared type', () => {
    const php = bytes('<?php echo 1; ?>');
    expect(sniffMime(php)).toBeNull();
    expect(signatureMatches('image/jpeg', php)).toBe(false);
    expect(signatureMatches('audio/mpeg', bytes(0x89, 'PNG'))).toBe(false);
    expect(signatureMatches('image/png', bytes(0x89, 'PNG'))).toBe(true);
    expect(signatureMatches('audio/x-m4a', bytes(0, 0, 0, 0x20, 'ftyp', 'M4A '))).toBe(true);
    expect(signatureMatches('application/x-msdownload', bytes('MZ'))).toBe(false);
  });
});
