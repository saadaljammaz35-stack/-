// App Studio files: validation, the streaming parser for model output, and
// what the preview/public routes serve. No server-only import: the parser and
// limits are unit-tested and the client shows the same limits.

export type AppFiles = Record<string, string>;

export const STUDIO_LIMITS = {
  maxFiles: 40,
  maxFileBytes: 200_000,
  maxTotalBytes: 1_000_000,
  maxPathLength: 120,
} as const;

const EXT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8",
  ts: "text/javascript; charset=utf-8",
  tsx: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
};

/** Lower-case relative paths of letters, digits, `-`, `_`, `.` and `/`; no `..`, no hidden files. */
export function normalizePath(raw: string): string | null {
  const p = raw.trim().replace(/^\.?\/+/, "");
  if (!p || p.length > STUDIO_LIMITS.maxPathLength) return null;
  if (!/^[A-Za-z0-9_\-./]+$/.test(p)) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s === "." || s === ".." || s.startsWith("."))) return null;
  const ext = p.split(".").pop()!.toLowerCase();
  if (!(ext in EXT_TYPES) || !p.includes(".")) return null;
  return p;
}

export function contentTypeFor(path: string): string {
  return EXT_TYPES[path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Throws a readable message when a file set exceeds the limits. */
export function checkFiles(files: AppFiles): void {
  const paths = Object.keys(files);
  if (paths.length > STUDIO_LIMITS.maxFiles) throw new Error(`An app may have at most ${STUDIO_LIMITS.maxFiles} files`);
  let total = 0;
  for (const p of paths) {
    if (normalizePath(p) !== p) throw new Error(`Invalid file path: ${p.slice(0, 80)}`);
    const n = byteLength(files[p]!);
    if (n > STUDIO_LIMITS.maxFileBytes) throw new Error(`${p} is larger than ${STUDIO_LIMITS.maxFileBytes / 1000} KB`);
    total += n;
  }
  if (total > STUDIO_LIMITS.maxTotalBytes) throw new Error(`The app is larger than ${STUDIO_LIMITS.maxTotalBytes / 1_000_000} MB`);
}

/** The page a preview or public link opens first. */
export function entryFile(files: AppFiles): string | null {
  if ("index.html" in files) return "index.html";
  return Object.keys(files).sort().find((p) => /\.html?$/i.test(p)) ?? null;
}

// ---------------------------------------------------------------------------
// Model output format
//
//   <omnix-file path="index.html">
//   …complete file content…
//   </omnix-file>
//   <omnix-delete path="old.js" />
//
// Everything outside these tags is the explanation shown in the chat.
// ---------------------------------------------------------------------------

export type ParseEvent =
  | { type: "text"; text: string }
  | { type: "file_start"; path: string }
  | { type: "file_progress"; path: string; bytes: number }
  | { type: "file_done"; path: string; content: string }
  | { type: "file_delete"; path: string }
  | { type: "warning"; message: string };

const OPEN = "<omnix-file";
const CLOSE = "</omnix-file>";
const DEL = "<omnix-delete";

/** Strips one Markdown fence the model may wrap a file in despite instructions. */
function unfence(content: string): string {
  let c = content.replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
  const m = /^```[\w+-]*\r?\n([\s\S]*?)\r?\n```$/.exec(c.trim());
  if (m) c = m[1]!;
  return c.endsWith("\n") ? c : `${c}\n`;
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(tag)?.[1] ?? new RegExp(`${name}\\s*=\\s*'([^']*)'`).exec(tag)?.[1] ?? null;
}

/**
 * Incremental parser: feed it chunks as they stream in. Text that could be
 * the start of a tag is held back until it is decided, so the chat never
 * shows half a tag and file content never leaks into the explanation.
 */
export class StudioOutputParser {
  private buf = "";
  private file: { path: string | null; content: string; lastReport: number } | null = null;

  push(chunk: string): ParseEvent[] {
    this.buf += chunk;
    return this.drain(false);
  }

  end(): ParseEvent[] {
    const out = this.drain(true);
    if (this.file) {
      out.push({ type: "warning", message: `The answer ended inside ${this.file.path ?? "a file"}; that file was not saved.` });
      this.file = null;
    }
    if (this.buf) {
      out.push({ type: "text", text: this.buf });
      this.buf = "";
    }
    return out;
  }

  private drain(final: boolean): ParseEvent[] {
    const out: ParseEvent[] = [];
    for (;;) {
      if (this.file) {
        const i = this.buf.indexOf(CLOSE);
        if (i === -1) {
          // Keep enough to recognise a closing tag split across chunks.
          const keep = final ? 0 : CLOSE.length - 1;
          const take = Math.max(0, this.buf.length - keep);
          this.file.content += this.buf.slice(0, take);
          this.buf = this.buf.slice(take);
          if (this.file.path && this.file.content.length - this.file.lastReport >= 2000) {
            this.file.lastReport = this.file.content.length;
            out.push({ type: "file_progress", path: this.file.path, bytes: this.file.content.length });
          }
          return out;
        }
        this.file.content += this.buf.slice(0, i);
        this.buf = this.buf.slice(i + CLOSE.length);
        if (this.file.path) out.push({ type: "file_done", path: this.file.path, content: unfence(this.file.content) });
        this.file = null;
        continue;
      }
      const o = this.buf.indexOf(OPEN);
      const d = this.buf.indexOf(DEL);
      const next = [o, d].filter((x) => x !== -1).sort((a, b) => a - b)[0];
      if (next === undefined) {
        // Hold back a trailing "<…" that might grow into a tag.
        const lt = final ? -1 : this.buf.lastIndexOf("<");
        const tail = lt === -1 ? "" : this.buf.slice(lt);
        const hold = lt !== -1 && (OPEN.startsWith(tail) || DEL.startsWith(tail));
        const emit = hold ? this.buf.slice(0, lt) : this.buf;
        if (emit) out.push({ type: "text", text: emit });
        this.buf = hold ? this.buf.slice(lt) : "";
        return out;
      }
      if (next > 0) out.push({ type: "text", text: this.buf.slice(0, next) });
      this.buf = this.buf.slice(next);
      const gt = this.buf.indexOf(">");
      if (gt === -1) {
        if (final) {
          out.push({ type: "warning", message: "An incomplete file tag was ignored." });
          this.buf = "";
        }
        return out;
      }
      const tag = this.buf.slice(0, gt + 1);
      this.buf = this.buf.slice(gt + 1);
      const raw = attr(tag, "path");
      const path = raw === null ? null : normalizePath(raw);
      if (tag.startsWith(DEL)) {
        if (path) out.push({ type: "file_delete", path });
        else out.push({ type: "warning", message: `Ignored a delete with an invalid path: ${String(raw).slice(0, 80)}` });
        continue;
      }
      if (!path) out.push({ type: "warning", message: `Ignored a file with an invalid path: ${String(raw).slice(0, 80)}` });
      else out.push({ type: "file_start", path });
      this.file = { path, content: "", lastReport: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Serving
// ---------------------------------------------------------------------------

/**
 * Runs before the app's own scripts. The app is served with an opaque origin
 * (CSP sandbox), where localStorage/sessionStorage throw; an in-memory
 * stand-in keeps simple apps working (data lasts until the page reloads).
 * Runtime errors are reported to the studio so the owner can ask for a fix.
 */
export const PREVIEW_SHIM = `<script>(function(){
function mem(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
function report(m){try{parent.postMessage({type:"omnix-preview-error",message:String(m).slice(0,2000)},"*")}catch(_){}}
window.addEventListener("error",function(e){report((e.message||"Error")+(e.filename?" ("+String(e.filename).split("/").pop()+":"+e.lineno+")":""))});
window.addEventListener("unhandledrejection",function(e){report("Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason))});
})();</script>`;

/**
 * Headers for every file of a generated app. `sandbox` gives the document an
 * opaque origin, so its scripts cannot use the owner's session or read
 * OMNIX data even though it is served from the same host; the app may load
 * public libraries and call public APIs.
 */
export function appFileHeaders(path: string, opts: { cache: "none" | "short" }): Headers {
  const h = new Headers();
  h.set("content-type", contentTypeFor(path));
  h.set(
    "content-security-policy",
    "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'",
  );
  h.set("access-control-allow-origin", "*");
  h.set("x-content-type-options", "nosniff");
  // The preview URL carries a capability token; never send it to third parties.
  h.set("referrer-policy", "no-referrer");
  h.set("cache-control", opts.cache === "none" ? "no-store" : "public, max-age=60");
  return h;
}

/** Resolves a requested path (possibly a directory) to a file in the app. */
export function resolveRequest(files: AppFiles, requested: string[]): string | null {
  const joined = requested.join("/");
  if (!joined) return entryFile(files);
  const p = normalizePath(joined);
  if (p && p in files) return p;
  const dirIndex = normalizePath(`${joined.replace(/\/+$/, "")}/index.html`);
  if (dirIndex && dirIndex in files) return dirIndex;
  return null;
}
