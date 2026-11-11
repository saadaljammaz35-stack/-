import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApi, OPENAPI_OPERATIONS } from "@/lib/api/openapi";

describe("OpenAPI document", () => {
  it("documents only routes that exist, with the documented method", () => {
    for (const op of OPENAPI_OPERATIONS) {
      const file = path.resolve("src/app", op.path.replace(/^\//, "").replace(/\{(\w+)\}/g, "[$1]"), "route.ts");
      expect(existsSync(file), `${op.method.toUpperCase()} ${op.path} → ${file}`).toBe(true);
      expect(readFileSync(file, "utf8"), `${op.path} exports ${op.method.toUpperCase()}`).toMatch(new RegExp(`export const ${op.method.toUpperCase()}\\b`));
    }
  });
  it("is valid-looking OpenAPI 3.1 with request schemas", () => {
    const doc = buildOpenApi() as { openapi: string; paths: Record<string, Record<string, { requestBody?: unknown }>> };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/api/ai/chat/stream"]!.post!.requestBody).toBeDefined();
  });
});
