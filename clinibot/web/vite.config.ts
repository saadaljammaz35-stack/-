import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/** The connect-src sources of the CSP in a header file's text. */
function connectSources(text: string): string[] {
  const csp =
    /Content-Security-Policy"?\s*[:,]\s*(?:"value":\s*)?"?([^"\n]+)/.exec(text)?.[1] ?? "";
  const part = csp
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("connect-src "));
  return part ? part.split(/\s+/).slice(1) : [];
}

/**
 * The CSP pins the Supabase project origin, while the app reads it from
 * VITE_SUPABASE_URL. Fail the build when they disagree, instead of shipping a
 * site whose every request the browser blocks.
 */
function cspMatchesSupabase(): Plugin {
  return {
    name: "clinibot-csp-matches-supabase",
    apply: "build",
    configResolved(config) {
      const value = loadEnv(config.mode, root, "VITE_").VITE_SUPABASE_URL;
      let host: string;
      try {
        host = new URL(value ?? "").host;
      } catch {
        // Unset or invalid: the app shows its "not configured" screen.
        config.logger.warn("VITE_SUPABASE_URL is not set; skipping the CSP check.");
        return;
      }
      const files = ["vercel.json", "public/_headers"];
      for (const file of files) {
        const sources = connectSources(readFileSync(`${root}${file}`, "utf8"));
        for (const needed of [`https://${host}`, `wss://${host}`]) {
          if (!sources.includes(needed)) {
            throw new Error(
              `${file}: the CSP connect-src lacks ${needed} (from VITE_SUPABASE_URL). ` +
                "Update the CSP in both vercel.json and public/_headers.",
            );
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspMatchesSupabase()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    // Placeholder values so modules that read the env can load in tests.
    // Nothing in the test suite talks to a real Supabase project.
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
