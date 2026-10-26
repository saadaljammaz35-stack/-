// Shared helpers for the content pipeline: cached HTTP fetches, hashing and file IO.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = join(ROOT, 'data');
export const CACHE_DIR = join(ROOT, '.data-cache');

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function cachePath(url) {
  return join(CACHE_DIR, sha256(url).slice(0, 32));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetches a URL (with retries) and caches the body on disk so re-runs are offline. */
export async function fetchBuffer(url, { cache = true, retries = 4 } = {}) {
  const file = cachePath(url);
  if (cache && existsSync(file)) return readFileSync(file);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'ma-allah-data-pipeline/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (cache) {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(file, buf);
      }
      return buf;
    } catch (err) {
      lastError = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

export async function fetchJson(url, opts) {
  const buf = await fetchBuffer(url, opts);
  return JSON.parse(buf.toString('utf8').replace(/^﻿/, ''));
}

export async function fetchText(url, opts) {
  return (await fetchBuffer(url, opts)).toString('utf8').replace(/^﻿/, '');
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function writeJson(relPath, value) {
  const file = join(DATA_DIR, relPath);
  mkdirSync(dirname(file), { recursive: true });
  const body = JSON.stringify(value);
  writeFileSync(file, body);
  return { file, bytes: Buffer.byteLength(body), sha256: sha256(body) };
}

export function readJson(relPath) {
  return JSON.parse(readFileSync(join(DATA_DIR, relPath), 'utf8'));
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Data check failed: ${message}`);
}

export function log(...args) {
  console.log('[data]', ...args);
}
