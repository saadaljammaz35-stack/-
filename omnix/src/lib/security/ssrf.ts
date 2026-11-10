import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { AppError } from "@/lib/http/errors";

// Server-side requests to user-supplied URLs (the fetch_url tool, user
// registered provider endpoints) must not reach internal networks, cloud
// metadata services or loopback. The check resolves DNS and validates EVERY
// address, then connects to the validated address only (no second lookup),
// which closes the DNS-rebinding window.

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isBlockedIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (fam === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isBlockedIp(mapped[1]!);
    return (
      s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || /^fe[89ab]/.test(s) ||
      s.startsWith("ff") || s.startsWith("2001:db8") || s.startsWith("64:ff9b") || s.startsWith("100::")
    );
  }
  return true;
}

export interface SafeTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

export async function assertPublicUrl(raw: string, opts: { httpsOnly?: boolean } = {}): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("VALIDATION_FAILED", "Invalid URL");
  }
  if (url.protocol !== "https:" && (opts.httpsOnly || url.protocol !== "http:")) {
    throw new AppError("VALIDATION_FAILED", opts.httpsOnly ? "Only https:// URLs are allowed" : "Only http(s) URLs are allowed");
  }
  if (url.username || url.password) throw new AppError("VALIDATION_FAILED", "Credentials in URLs are not allowed");
  if (url.port && !["80", "443", "8443"].includes(url.port)) throw new AppError("VALIDATION_FAILED", "Port not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) {
    throw new AppError("FORBIDDEN", "Internal hosts are not allowed");
  }
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) as 4 | 6 }] : await lookup(host, { all: true, verbatim: true });
  if (addrs.length === 0) throw new AppError("BAD_REQUEST", "Host did not resolve");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new AppError("FORBIDDEN", "Destination address is not allowed");
  }
  const first = addrs[0]!;
  return { url, address: first.address, family: first.family as 4 | 6 };
}

/**
 * GET a public URL with SSRF protection, pinned to the validated IP, no
 * redirects followed, size and time capped. Returns text.
 */
export async function safeFetchText(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ status: number; contentType: string; text: string; truncated: boolean }> {
  const target = await assertPublicUrl(raw);
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const req = target.url.protocol === "https:" ? httpsRequest : httpRequest;
  return await new Promise((resolve, reject) => {
    const r = req(
      {
        host: target.address,
        servername: isIP(target.url.hostname) ? undefined : target.url.hostname,
        port: target.url.port || (target.url.protocol === "https:" ? 443 : 80),
        path: `${target.url.pathname}${target.url.search}`,
        method: "GET",
        headers: { host: target.url.host, "user-agent": "OMNIX-Fetch/1.0", accept: "text/*, application/json" },
        timeout: timeoutMs,
        signal: opts.signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          if (truncated) return;
          size += c.length;
          if (size > maxBytes) {
            truncated = true;
            chunks.push(c.subarray(0, c.length - (size - maxBytes)));
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            text: Buffer.concat(chunks).toString("utf8"),
            truncated,
          });
        res.on("end", done);
        res.on("close", done);
        res.on("error", (e) => (truncated ? done() : reject(e)));
      },
    );
    r.on("timeout", () => r.destroy(new AppError("PROVIDER_TIMEOUT", "Fetch timed out")));
    r.on("error", reject);
    r.end();
  });
}
