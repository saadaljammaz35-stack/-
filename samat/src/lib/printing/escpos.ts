// Minimal ESC/POS encoder. Arabic cannot be printed reliably with printer code pages (no shaping),
// so receipts are sent as a 1-bit raster image (GS v 0), which every common thermal printer supports.
export class EscPos {
  private chunks: number[] = [];
  init() { this.chunks.push(0x1b, 0x40); return this; }
  align(a: 'left' | 'center' | 'right') { this.chunks.push(0x1b, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2); return this; }
  feed(lines = 1) { this.chunks.push(0x1b, 0x64, Math.max(0, Math.min(255, lines))); return this; }
  cut() { this.chunks.push(0x1d, 0x56, 0x42, 0x00); return this; }
  /** ASCII-only text (used for test pages). */
  text(s: string) { for (const ch of s) this.chunks.push(ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 0x3f); this.chunks.push(0x0a); return this; }
  /**
   * Raster image from greyscale/RGBA pixels. width must be the printer dot width
   * (576 for 80mm, 384 for 58mm at 203dpi).
   */
  raster(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, channels: 1 | 3 | 4 = 4, threshold = 160) {
    const bytesPerRow = Math.ceil(width / 8);
    // print in bands to stay within printer buffer limits
    const band = 256;
    for (let y0 = 0; y0 < height; y0 += band) {
      const h = Math.min(band, height - y0);
      this.chunks.push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, h & 0xff, h >> 8);
      for (let y = y0; y < y0 + h; y++) {
        for (let bx = 0; bx < bytesPerRow; bx++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = bx * 8 + bit;
            if (x >= width) continue;
            const i = (y * width + x) * channels;
            const lum = channels === 1 ? pixels[i] : 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            const alpha = channels === 4 ? pixels[i + 3] : 255;
            if (alpha > 128 && lum < threshold) byte |= 0x80 >> bit;
          }
          this.chunks.push(byte);
        }
      }
    }
    return this;
  }
  bytes(): Uint8Array { return Uint8Array.from(this.chunks); }
}

export const PRINTER_DOTS = { '80mm': 576, '58mm': 384 } as const;
