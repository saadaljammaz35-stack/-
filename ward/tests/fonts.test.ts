import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const WEIGHTS = { Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900 } as const;

describe('WARD TYPE Original', () => {
  it('ships all five weights as WOFF2 and TTF with valid signatures', () => {
    for (const name of Object.keys(WEIGHTS)) {
      const woff2 = readFileSync(path.join(root, 'public/fonts', `WARDTypeOriginal-${name}.woff2`));
      const ttf = readFileSync(path.join(root, 'public/fonts', `WARDTypeOriginal-${name}.ttf`));
      expect(woff2.subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(ttf.readUInt32BE(0)).toBe(0x00010000); // TrueType outlines
      expect(woff2.length).toBeGreaterThan(10_000);
      expect(ttf.length).toBeGreaterThan(woff2.length);
    }
  });

  it('is wired into the shared stylesheet with the right weight for every file', () => {
    const css = readFileSync(path.join(root, 'src/app/ward-type.css'), 'utf8');
    for (const [name, weight] of Object.entries(WEIGHTS)) {
      const block = css.split('@font-face').find((b) => b.includes(`WARDTypeOriginal-${name}.woff2`));
      expect(block, name).toBeDefined();
      expect(block).toContain(`WARDTypeOriginal-${name}.ttf`);
      expect(block).toContain(`font-weight: ${weight};`);
      expect(block).toContain("font-family: 'WARD Type Original'");
    }
    const layout = readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');
    expect(layout).toContain("import './ward-type.css'");
  });

  it('was built by the unmodified v0.1 source (glyph design untouched)', () => {
    const tool = path.join(root, 'tools/ward-type/build.py');
    expect(existsSync(tool)).toBe(true);
    const hash = createHash('sha256').update(readFileSync(tool)).digest('hex');
    expect(hash).toBe('b3aab94421a4c59ae7f9e04bd010edda2d3cb538e60c5bac72449b592627abf4');
  });
});
