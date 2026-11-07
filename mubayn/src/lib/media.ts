import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { config } from "./config";

/** File-type detection from content (never trust the browser's MIME type). */
export function detectMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm";
  if (head.length >= 12 && head.toString("ascii", 4, 8) === "ftyp") {
    const brand = head.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "mif1", "msf1", "avif", "avis"].includes(brand)) return "image/heic";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export async function imageInfo(buf: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buf, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height) throw new Error("Image has no dimensions");
  if (meta.width < 320 || meta.height < 320) throw new Error("Image is too small to inspect (min 320 px)");
  return { width: meta.width, height: meta.height };
}

/**
 * The copy sent to the model: auto-rotated by EXIF, metadata (GPS etc.)
 * stripped, long edge capped at 1568 px (Claude's recommended maximum).
 */
export async function analysisCopy(buf: Buffer): Promise<Buffer> {
  return sharp(buf, { failOn: "error" })
    .rotate()
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

export async function thumbnail(buf: Buffer): Promise<Buffer> {
  return sharp(buf).rotate().resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 75 }).toBuffer();
}

function ffmpegPath(): string {
  const c = config();
  if (c.FFMPEG_PATH) return c.FFMPEG_PATH;
  const req = createRequire(import.meta.url);
  const p = req("ffmpeg-static") as string | null;
  if (!p) throw new Error("ffmpeg binary not available");
  return p;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, timeoutMs);
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < 200_000) stderr += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

/** Duration in ms, read by ffmpeg itself (no ffprobe dependency). */
export async function videoDurationMs(buf: Buffer): Promise<number> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mby-"));
  try {
    const input = path.join(dir, "in");
    await writeFile(input, buf);
    const { stderr } = await run(ffmpegPath(), ["-hide_banner", "-i", input], 30_000);
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    if (!m) throw new Error("Not a readable video");
    const ms = Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
    if (!/Stream #\d+:\d+.*Video:/.test(stderr)) throw new Error("File has no video stream");
    return ms;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Extracts evenly spaced frames. Each frame keeps its timestamp so a finding
 * can cite "video at 0:12".
 */
export async function extractFrames(buf: Buffer, durationMs: number, maxFrames = 8): Promise<{ timeMs: number; jpeg: Buffer }[]> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mby-"));
  try {
    const input = path.join(dir, "in");
    await writeFile(input, buf);
    const count = Math.max(1, Math.min(maxFrames, Math.floor(durationMs / 2000)));
    const times = Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * durationMs) / count));
    const out: { timeMs: number; jpeg: Buffer }[] = [];
    for (const [i, t] of times.entries()) {
      const file = path.join(dir, `f${i}.jpg`);
      const { code, stderr } = await run(
        ffmpegPath(),
        ["-hide_banner", "-loglevel", "error", "-ss", (t / 1000).toFixed(3), "-i", input, "-frames:v", "1", "-vf", "scale='min(1568,iw)':-2", "-q:v", "3", file],
        60_000,
      );
      if (code !== 0) throw new Error(`Frame extraction failed: ${stderr.slice(0, 300)}`);
      out.push({ timeMs: t, jpeg: await readFile(file) });
    }
    if ((await readdir(dir)).length < out.length) throw new Error("Missing frames");
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
