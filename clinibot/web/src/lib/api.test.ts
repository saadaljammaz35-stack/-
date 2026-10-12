import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
// A rejected promise returned through vi.fn() is reported by Vitest as an
// unhandled rejection, so thrown fetch errors bypass the mock.
let throwOnInvoke: Error | null = null;
vi.mock("./supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) =>
        throwOnInvoke ? Promise.reject(throwOnInvoke) : (invoke(...args) as unknown),
    },
  },
}));

const { ApiError, callFunction } = await import("./api");

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("callFunction", () => {
  beforeEach(() => {
    invoke.mockReset();
    throwOnInvoke = null;
  });

  it("returns the data on success and sends a POST with the body", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(
      callFunction<{ ok: boolean }>("system-status", { organization_id: "o1" }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(invoke).toHaveBeenCalledWith("system-status", {
      method: "POST",
      body: { organization_id: "o1" },
    });
  });

  it("turns the documented error body into an ApiError", async () => {
    const response = jsonResponse(409, {
      error: "seat_limit",
      message: "Seat limit reached",
      details: { seats: 3 },
      request_id: "req-123",
    });
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(response) });

    const error = await callFunction("invite-member", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "seat_limit",
      message: "Seat limit reached",
      details: { seats: 3 },
      requestId: "req-123",
    });
  });

  it("exposes field issues and retry-after", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        jsonResponse(400, {
          error: "invalid_request",
          message: "Invalid",
          details: [{ path: "email", message: "Invalid email" }],
          request_id: "r",
        }),
      ),
    });
    const invalid = (await callFunction("invite-member", {}).catch(
      (e: unknown) => e,
    )) as InstanceType<typeof ApiError>;
    expect(invalid.fieldIssues).toEqual([{ path: "email", message: "Invalid email" }]);

    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        jsonResponse(429, {
          error: "rate_limited",
          message: "Slow down",
          details: { retry_after_seconds: 30 },
        }),
      ),
    });
    const limited = (await callFunction("assistant-test", {}).catch(
      (e: unknown) => e,
    )) as InstanceType<typeof ApiError>;
    expect(limited.retryAfterSeconds).toBe(30);
  });

  it("falls back to a status-based code when the body is not ours", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response("Bad gateway", { status: 502 })),
    });
    await expect(callFunction("assistant-test", {})).rejects.toMatchObject({
      status: 502,
      code: "upstream_error",
    });
  });

  it("reports network failures as network_error", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError("Failed to fetch")),
    });
    await expect(callFunction("system-status", {})).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });

    throwOnInvoke = new TypeError("Failed to fetch");
    await expect(callFunction("system-status", {})).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });
});
