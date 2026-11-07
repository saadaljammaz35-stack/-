import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";
import { safeEqual } from "./crypto";

/**
 * Private object storage. Production: any S3-compatible bucket (AWS S3,
 * Cloudflare R2, ...) with public access blocked; browsers upload and
 * download through short-lived presigned URLs only after the server has
 * checked ownership. The "local" driver is for development and is refused in
 * production by config.ts.
 */

export interface Storage {
  presignPut(key: string, contentType: string, bytes: number, ttlSeconds?: number): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, opts?: { filename?: string; ttlSeconds?: number; inline?: boolean; contentType?: string }): Promise<string>;
  head(key: string): Promise<{ bytes: number; contentType: string | null } | null>;
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  publicOrigin(): string | null;
}

// ── S3 ──────────────────────────────────────────────────────────────────────

class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  constructor() {
    const c = config();
    if (!c.S3_BUCKET || !c.S3_REGION || !c.S3_ACCESS_KEY_ID || !c.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage needs S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
    }
    this.bucket = c.S3_BUCKET;
    this.client = new S3Client({
      region: c.S3_REGION,
      endpoint: c.S3_ENDPOINT,
      forcePathStyle: c.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: c.S3_ACCESS_KEY_ID, secretAccessKey: c.S3_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  async presignPut(key: string, contentType: string, bytes: number, ttlSeconds = 900) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: bytes }),
      { expiresIn: ttlSeconds, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return { url, headers: { "content-type": contentType } };
  }
  async presignGet(key: string, opts: { filename?: string; ttlSeconds?: number; inline?: boolean; contentType?: string } = {}) {
    const disposition = opts.filename
      ? `${opts.inline ? "inline" : "attachment"}; filename="${opts.filename.replace(/[^\w.\-]/g, "_")}"`
      : undefined;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition, ResponseContentType: opts.contentType }),
      { expiresIn: opts.ttlSeconds ?? 300 },
    );
  }
  async head(key: string) {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { bytes: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (e as Error).name === "NotFound") return null;
      throw e;
    }
  }
  async get(key: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: [{ Key: key }], Quiet: true } }));
  }
  async deletePrefix(prefix: string) {
    let deleted = 0;
    let token: string | undefined;
    do {
      const list = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
        deleted += keys.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
  publicOrigin() {
    const c = config();
    if (c.S3_ENDPOINT) {
      const u = new URL(c.S3_ENDPOINT);
      return c.S3_FORCE_PATH_STYLE ? u.origin : `${u.protocol}//${c.S3_BUCKET}.${u.host}`;
    }
    return `https://${c.S3_BUCKET}.s3.${c.S3_REGION}.amazonaws.com`;
  }
}

// ── local (development only) ────────────────────────────────────────────────

function signingKey(): Buffer {
  return createHmac("sha256", config().ENCRYPTION_KEY).update("local-storage-v1").digest();
}

export type LocalGrant = { op: "put" | "get"; key: string; ct?: string; bytes?: number; exp: number; fn?: string; inline?: boolean };

export function signLocalGrant(g: LocalGrant): string {
  const body = Buffer.from(JSON.stringify(g)).toString("base64url");
  const mac = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyLocalGrant(token: string): LocalGrant | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", signingKey()).update(body).digest("base64url");
  if (!safeEqual(mac, expected)) return null;
  const g = JSON.parse(Buffer.from(body, "base64url").toString()) as LocalGrant;
  if (g.exp < Date.now()) return null;
  return g;
}

class LocalStorage implements Storage {
  private root = path.resolve(config().LOCAL_STORAGE_DIR, "objects");
  private file(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid key");
    return p;
  }
  async presignPut(key: string, contentType: string, bytes: number, ttlSeconds = 900) {
    const t = signLocalGrant({ op: "put", key, ct: contentType, bytes, exp: Date.now() + ttlSeconds * 1000 });
    return { url: `${config().APP_URL}/api/dev-storage/${t}`, headers: { "content-type": contentType } };
  }
  async presignGet(key: string, opts: { filename?: string; ttlSeconds?: number; inline?: boolean; contentType?: string } = {}) {
    const t = signLocalGrant({ op: "get", key, ct: opts.contentType, fn: opts.filename, inline: opts.inline, exp: Date.now() + (opts.ttlSeconds ?? 300) * 1000 });
    return `${config().APP_URL}/api/dev-storage/${t}`;
  }
  async head(key: string) {
    try {
      const s = await stat(this.file(key));
      const meta = await readFile(this.file(key) + ".meta", "utf8").catch(() => "{}");
      return { bytes: s.size, contentType: (JSON.parse(meta) as { ct?: string }).ct ?? null };
    } catch {
      return null;
    }
  }
  async get(key: string) {
    return readFile(this.file(key));
  }
  async put(key: string, body: Buffer, contentType: string) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
    await writeFile(f + ".meta", JSON.stringify({ ct: contentType }));
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true });
    await rm(this.file(key) + ".meta", { force: true });
  }
  async deletePrefix(prefix: string) {
    // Prefixes are always directory-shaped ("u/<id>/").
    const dir = this.file(prefix.replace(/\/$/, "") + "/x").slice(0, -2);
    let n = 0;
    try {
      n = (await readdir(dir, { recursive: true })).filter((f) => !String(f).endsWith(".meta")).length;
    } catch {
      return 0;
    }
    await rm(dir, { recursive: true, force: true });
    return n;
  }
  publicOrigin() {
    return null;
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  if (!instance) instance = config().STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}
