import { afterEach, describe, expect, it, vi } from "vitest";
import { apiKeyProblem, config, ConfigError, resetConfigForTests } from "@/lib/config";
import { redactSecrets } from "@/lib/errors";

const prod = {
  NODE_ENV: "production",
  APP_URL: "https://mubayn.example",
  DATABASE_URL: "postgresql://x",
  ENCRYPTION_KEY: "cHJvZC1rZXktcHJvZC1rZXktcHJvZC1rZXktcHJvZC1rZXk=",
  STORAGE_DRIVER: "s3",
  EMAIL_DRIVER: "resend",
};

describe("production configuration guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigForTests();
  });
  const load = (env: Record<string, string>) => {
    // Start from a clean slate: the CI job itself sets test-only variables.
    for (const k of ["ANTHROPIC_BASE_URL_OVERRIDE", "S3_ENDPOINT", "CRON_SECRET"]) vi.stubEnv(k, undefined);
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    resetConfigForTests();
    return () => config();
  };
  it("accepts a real production setup", () => {
    expect(load(prod)().STORAGE_DRIVER).toBe("s3");
  });
  it.each([
    ["local storage", { STORAGE_DRIVER: "local" }],
    ["console e-mail", { EMAIL_DRIVER: "console" }],
    ["plain http", { APP_URL: "http://mubayn.example" }],
    ["an AI test double", { ANTHROPIC_BASE_URL_OVERRIDE: "http://localhost:3999" }],
  ])("refuses %s", (_name, override) => {
    expect(load({ ...prod, ...override })).toThrow(ConfigError);
  });
});

describe("API key handling", () => {
  afterEach(() => vi.unstubAllEnvs());
  // Built at runtime so no key-shaped literal sits in the repository.
  const fakeKey = ["sk", "ant", "api03", "x".repeat(40)].join("-");

  it("accepts a bare key and rejects anything that is not one", () => {
    expect(apiKeyProblem(undefined)).toBe("missing");
    expect(apiKeyProblem("")).toBe("missing");
    expect(apiKeyProblem(fakeKey)).toBeNull();
    expect(apiKeyProblem("test-key-not-real")).toBeNull();
    expect(apiKeyProblem(`curl https://api.anthropic.com/v1/messages --header "x-api-key: ${fakeKey}"`)).toBe("malformed");
    expect(apiKeyProblem(`"${fakeKey}"`)).toBe("malformed");
    expect(apiKeyProblem(`${fakeKey} extra`)).toBe("malformed");
  });

  it("redacts configured secrets and key-shaped strings from text", () => {
    const pasted = `curl https://api.anthropic.com/v1/messages --header "x-api-key: ${fakeKey}"`;
    vi.stubEnv("ANTHROPIC_API_KEY", pasted);
    vi.stubEnv("CRON_SECRET", "cron-secret-value-0123456789");
    const msg = `Headers.append: "Bearer ${pasted.slice(0, 80)}" is invalid; cron=cron-secret-value-0123456789; db postgresql://user:hunter2pass@host/db`;
    const out = redactSecrets(msg);
    expect(out).not.toContain(fakeKey.slice(0, 20));
    expect(out).not.toContain("cron-secret-value");
    expect(out).not.toContain("hunter2pass");
    expect(redactSecrets(`token ${fakeKey} end`)).toBe("token [ANTHROPIC_API_KEY] end");
    // A key that is not in any env var is still caught by its shape.
    vi.unstubAllEnvs();
    expect(redactSecrets(`token ${fakeKey} end`)).toBe("token sk-ant-[redacted] end");
  });
});
