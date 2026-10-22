import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import headersFile from "../public/_headers?raw";
import vercelFile from "../vercel.json?raw";

/**
 * The Supabase project in .env.example (Vite refuses to import .env files). When the
 * project changes, update both header files and this line; `vite build` also checks
 * the real VITE_SUPABASE_URL against both files (vite.config.ts).
 */
const PROJECT_HOST = "clpfcrsoxokhcbrzxgkt.supabase.co";

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

function vercelCsp(): string {
  const config = JSON.parse(vercelFile) as VercelConfig;
  const all = config.headers.flatMap((entry) => entry.headers);
  return all.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
}

function headersCsp(): string {
  const line = headersFile
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text.startsWith("Content-Security-Policy:"));
  return line?.slice("Content-Security-Policy:".length).trim() ?? "";
}

function directive(csp: string, name: string): string[] {
  const part = csp
    .split(";")
    .map((text) => text.trim())
    .find((text) => text.startsWith(`${name} `));
  return part ? part.split(/\s+/).slice(1) : [];
}

describe("hosting headers", () => {
  it("vercel.json and public/_headers send the same CSP", () => {
    expect(vercelCsp()).not.toBe("");
    expect(headersCsp()).toBe(vercelCsp());
  });

  it("connect-src allows only this app's Supabase project, over https and wss", () => {
    const host = PROJECT_HOST;
    expect(directive(vercelCsp(), "connect-src").sort()).toEqual(
      ["'self'", `https://${host}`, `wss://${host}`].sort(),
    );
    expect(vercelCsp()).not.toContain("*.supabase.co");
  });

  it("does not allow inline styles", () => {
    expect(directive(vercelCsp(), "style-src")).not.toContain("'unsafe-inline'");
  });

  it("serves fonts and styles from this site only (Tajawal is bundled, no font CDN)", () => {
    expect(directive(vercelCsp(), "font-src")).toEqual(["'self'"]);
    expect(directive(vercelCsp(), "style-src")).toEqual(["'self'"]);
    expect(vercelCsp()).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});
