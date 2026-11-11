import { describe, expect, it } from "vitest";
import {
  appFileHeaders,
  checkFiles,
  entryFile,
  normalizePath,
  resolveRequest,
  StudioOutputParser,
  STUDIO_LIMITS,
  type ParseEvent,
} from "@/lib/ai/studio/files";

const ANSWER = `سأبني صفحة ترحيب بسيطة.
<omnix-file path="index.html">
<!doctype html>
<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="style.css"></head>
<body><h1>مرحبا</h1><script src="app.js"></script></body></html>
</omnix-file>
<omnix-file path="style.css">
body { color: #333; }
</omnix-file>
<omnix-delete path="old.js" />`;

function parseAll(chunks: string[]): ParseEvent[] {
  const p = new StudioOutputParser();
  return [...chunks.flatMap((c) => p.push(c)), ...p.end()];
}

function summarize(events: ParseEvent[]) {
  return {
    text: events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join(""),
    files: Object.fromEntries(events.filter((e) => e.type === "file_done").map((e) => [(e as { path: string }).path, (e as { content: string }).content])),
    deleted: events.filter((e) => e.type === "file_delete").map((e) => (e as { path: string }).path),
    warnings: events.filter((e) => e.type === "warning").map((e) => (e as { message: string }).message),
  };
}

describe("studio output parser", () => {
  it("separates the explanation from complete files and deletions", () => {
    const s = summarize(parseAll([ANSWER]));
    expect(s.text.trim()).toBe("سأبني صفحة ترحيب بسيطة.");
    expect(Object.keys(s.files)).toEqual(["index.html", "style.css"]);
    expect(s.files["style.css"]).toBe("body { color: #333; }\n");
    expect(s.files["index.html"]).toContain("<h1>مرحبا</h1>");
    expect(s.files["index.html"]!.startsWith("<!doctype html>")).toBe(true);
    expect(s.deleted).toEqual(["old.js"]);
    expect(s.warnings).toEqual([]);
  });

  it("gives the same result when streamed one character at a time", () => {
    expect(summarize(parseAll([...ANSWER]))).toEqual(summarize(parseAll([ANSWER])));
  });

  it("never shows part of a tag as explanation text while streaming", () => {
    const p = new StudioOutputParser();
    const shown = [...ANSWER].flatMap((c) => p.push(c)).filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
    expect(shown).not.toContain("<omnix");
    expect(shown).not.toContain("body {");
  });

  it("strips a Markdown fence the model added around a file", () => {
    const s = summarize(parseAll(['<omnix-file path="app.js">\n```js\nconsole.log(1);\n```\n</omnix-file>']));
    expect(s.files["app.js"]).toBe("console.log(1);\n");
  });

  it("ignores files with unsafe paths and says so", () => {
    const s = summarize(parseAll(['<omnix-file path="../secret.js">x</omnix-file><omnix-file path="/etc/passwd.txt">y</omnix-file><omnix-file path="a.exe">z</omnix-file>']));
    expect(s.files).toEqual({ "etc/passwd.txt": "y\n" });
    expect(s.warnings).toHaveLength(2);
  });

  it("does not save a file the answer stopped in the middle of", () => {
    const s = summarize(parseAll(['ok <omnix-file path="index.html">\n<html><body>half']));
    expect(s.files).toEqual({});
    expect(s.warnings[0]).toMatch(/index\.html/);
  });
});

describe("studio files", () => {
  it("normalises safe relative paths and rejects the rest", () => {
    expect(normalizePath("./src/main.js")).toBe("src/main.js");
    expect(normalizePath("/index.html")).toBe("index.html");
    for (const bad of ["../x.js", "a/../../b.js", ".env.js", "src/.hidden.css", "x", "a.php", "dir/", "a b.js", "a\\b.js", "x".repeat(130) + ".js"]) {
      expect(normalizePath(bad)).toBeNull();
    }
  });

  it("enforces the size and count limits", () => {
    expect(() => checkFiles({ "index.html": "x" })).not.toThrow();
    expect(() => checkFiles({ "big.js": "x".repeat(STUDIO_LIMITS.maxFileBytes + 1) })).toThrow(/larger/);
    const many = Object.fromEntries(Array.from({ length: STUDIO_LIMITS.maxFiles + 1 }, (_, i) => [`f${i}.js`, "x"]));
    expect(() => checkFiles(many)).toThrow(/at most/);
    expect(() => checkFiles({ "../x.js": "x" })).toThrow(/Invalid/);
  });

  it("opens index.html first and resolves directory requests", () => {
    const files = { "about/index.html": "a", "index.html": "i", "style.css": "s" };
    expect(entryFile(files)).toBe("index.html");
    expect(entryFile({ "page.html": "p" })).toBe("page.html");
    expect(resolveRequest(files, [])).toBe("index.html");
    expect(resolveRequest(files, ["about"])).toBe("about/index.html");
    expect(resolveRequest(files, ["style.css"])).toBe("style.css");
    expect(resolveRequest(files, ["..", "secret"])).toBeNull();
    expect(resolveRequest(files, ["missing.js"])).toBeNull();
  });

  it("serves every file sandboxed (opaque origin), without leaking the URL", () => {
    const h = appFileHeaders("index.html", { cache: "none" });
    expect(h.get("content-security-policy")).toMatch(/^sandbox allow-scripts/);
    expect(h.get("content-security-policy")).not.toMatch(/allow-same-origin/);
    expect(h.get("content-security-policy")).toMatch(/frame-ancestors 'self'/);
    expect(h.get("referrer-policy")).toBe("no-referrer");
    expect(h.get("content-type")).toBe("text/html; charset=utf-8");
    expect(appFileHeaders("a.css", { cache: "short" }).get("cache-control")).toBe("public, max-age=60");
  });
});
