import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  initialize: vi.fn(),
  getSession: vi.fn(),
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth }, initialHref: "" }));

const { completeAuthFromUrl, retryAuthFromUrl } = await import("./urlAuth");

const ORIGIN = "http://localhost:3000";
const signedIn = { user: { id: "owner-1", email: "owner@clinic.sa" } };
const linkSession = { user: { id: "link-user", email: "new@clinic.sa" } };

function signedInAs(session: unknown) {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
}

// Each link is remembered per URL, so every test uses its own token values.
let n = 0;
function unique() {
  n += 1;
  return `t${n}`;
}

describe("completeAuthFromUrl", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    auth.initialize.mockResolvedValue({ error: null });
    auth.setSession.mockResolvedValue({ data: { session: linkSession }, error: null });
    auth.verifyOtp.mockResolvedValue({ data: { session: linkSession }, error: null });
    replaceState = vi.spyOn(window.history, "replaceState");
  });

  it("leaves a token-hash link unused while someone is already signed in", async () => {
    signedInAs(signedIn);
    const href = `${ORIGIN}/auth/callback?token_hash=${unique()}&type=signup`;
    await expect(completeAuthFromUrl(href)).resolves.toEqual({
      status: "conflict",
      email: "owner@clinic.sa",
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    // The address keeps the link, so it can still be used after signing out.
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("leaves invitation tokens unused while someone is already signed in", async () => {
    signedInAs(signedIn);
    const href = `${ORIGIN}/auth/accept-invite#access_token=${unique()}&refresh_token=r&type=invite`;
    await expect(completeAuthFromUrl(href)).resolves.toEqual({
      status: "conflict",
      email: "owner@clinic.sa",
    });
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("ignores implicit tokens anywhere but an invitation on /auth/accept-invite", async () => {
    signedInAs(null);
    for (const href of [
      `${ORIGIN}/auth/callback#access_token=${unique()}&refresh_token=r&type=signup`,
      `${ORIGIN}/auth/callback#access_token=${unique()}&refresh_token=r&type=invite`,
      `${ORIGIN}/reset-password#access_token=${unique()}&refresh_token=r&type=recovery`,
      `${ORIGIN}/auth/accept-invite#access_token=${unique()}&refresh_token=r&type=signup`,
    ]) {
      await expect(completeAuthFromUrl(href)).resolves.toEqual({ status: "none" });
    }
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("signs in from an invitation when nobody is signed in, marked as coming from the link", async () => {
    signedInAs(null);
    const token = unique();
    const href = `${ORIGIN}/auth/accept-invite#access_token=${token}&refresh_token=r&type=invite`;
    await expect(completeAuthFromUrl(href)).resolves.toEqual({
      status: "session",
      type: "invite",
      via: "link",
    });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: token, refresh_token: "r" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/accept-invite");
  });

  it("verifies a token-hash link when nobody is signed in", async () => {
    signedInAs(null);
    const tokenHash = unique();
    const href = `${ORIGIN}/auth/callback?token_hash=${tokenHash}&type=signup`;
    await expect(completeAuthFromUrl(href)).resolves.toEqual({
      status: "session",
      type: "signup",
      via: "link",
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: "signup" });
  });

  it("does not treat this browser's own PKCE code as a conflict", async () => {
    signedInAs(signedIn);
    const href = `${ORIGIN}/auth/callback?code=${unique()}&type=signup`;
    await expect(completeAuthFromUrl(href)).resolves.toEqual({
      status: "session",
      type: "signup",
      via: "code",
    });
  });

  it("uses the link after the signed-in person signs out and retries", async () => {
    signedInAs(signedIn);
    const href = `${ORIGIN}/reset-password?token_hash=${unique()}&type=recovery`;
    await expect(completeAuthFromUrl(href)).resolves.toMatchObject({ status: "conflict" });
    // Same URL again: the remembered answer, nothing used.
    await expect(completeAuthFromUrl(href)).resolves.toMatchObject({ status: "conflict" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();

    signedInAs(null);
    await expect(retryAuthFromUrl(href)).resolves.toEqual({
      status: "session",
      type: "recovery",
      via: "link",
    });
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
  });
});
