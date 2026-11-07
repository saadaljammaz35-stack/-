import { afterEach, describe, expect, it, vi } from "vitest";
import { config, ConfigError, resetConfigForTests } from "@/lib/config";

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
