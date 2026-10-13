/**
 * Geometry for "the handoff line" in How it works: a path that travels down
 * through one node per step (patient → assistant → reception), drawn as the
 * visitor scrolls. Pure functions so the maths is testable without a browser.
 */

export interface Point {
  x: number;
  y: number;
}

/** One cubic Bézier piece between two neighbouring nodes. */
export interface Segment {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

/**
 * Builds the path through the node centres (ys, top to bottom) on a vertical
 * axis at `centerX`. Each piece bows gently to alternating sides by `swing`.
 * Control points keep y increasing, so the path never turns back upwards and
 * revealing it from the top reads as the line drawing itself.
 */
export function buildSegments(ys: readonly number[], centerX: number, swing: number): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index < ys.length - 1; index += 1) {
    const y0 = ys[index]!;
    const y1 = ys[index + 1]!;
    const dy = y1 - y0;
    const side = index % 2 === 0 ? 1 : -1;
    segments.push({
      p0: { x: centerX, y: y0 },
      c1: { x: centerX + swing * side, y: y0 + dy * 0.3 },
      c2: { x: centerX + swing * side, y: y1 - dy * 0.3 },
      p1: { x: centerX, y: y1 },
    });
  }
  return segments;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** SVG path data for the segments ("" when there is nothing to draw). */
export function pathData(segments: readonly Segment[]): string {
  const first = segments[0];
  if (!first) return "";
  const parts = [`M${round(first.p0.x)} ${round(first.p0.y)}`];
  for (const { c1, c2, p1 } of segments) {
    parts.push(
      `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p1.x)} ${round(p1.y)}`,
    );
  }
  return parts.join(" ");
}

function cubic(t: number, a: number, b: number, c: number, d: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** The point on the path at height `y`, or null above the first node or with no path. */
export function pointAtY(segments: readonly Segment[], y: number): Point | null {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last || y < first.p0.y) return null;
  if (y >= last.p1.y) return { ...last.p1 };
  const segment = segments.find((piece) => y <= piece.p1.y) ?? last;
  // y(t) is monotonic on each piece: bisect for t.
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    const midY = cubic(mid, segment.p0.y, segment.c1.y, segment.c2.y, segment.p1.y);
    if (midY < y) low = mid;
    else high = mid;
  }
  const t = (low + high) / 2;
  return {
    x: cubic(t, segment.p0.x, segment.c1.x, segment.c2.x, segment.p1.x),
    y: cubic(t, segment.p0.y, segment.c1.y, segment.c2.y, segment.p1.y),
  };
}

/**
 * How much of a block (0…1) has passed a reading line placed at `anchor` of
 * the viewport height. `top` is the block's top relative to the viewport.
 */
export function revealProgress(
  top: number,
  height: number,
  viewportHeight: number,
  anchor = 0.62,
): number {
  if (!(height > 0)) return 0;
  const passed = viewportHeight * anchor - top;
  return Math.min(1, Math.max(0, passed / height));
}

/** Number of nodes (ys sorted top to bottom) the revealed part has reached. */
export function litCount(ys: readonly number[], revealedY: number): number {
  let count = 0;
  for (const y of ys) {
    if (revealedY + 0.5 >= y) count += 1;
    else break;
  }
  return count;
}
