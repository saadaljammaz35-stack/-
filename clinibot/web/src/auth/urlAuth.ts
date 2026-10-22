import type { EmailOtpType } from "@supabase/supabase-js";
import { initialHref, supabase } from "@/lib/supabase";

/**
 * Finishes sign-in from an email link (confirmation, password recovery,
 * invitation). Supabase can deliver the result in three shapes, all handled:
 *
 *  1. PKCE: `?code=…` — exchanged automatically by supabase-js on start-up
 *     (needs the code verifier saved by the browser that asked for the email).
 *  2. Token hash: `?token_hash=…&type=signup|recovery|invite|email_change` —
 *     works in any browser; use it in custom email templates:
 *     `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
 *  3. Implicit: `#access_token=…&refresh_token=…&type=invite` — what
 *     admin-sent invitations produce. supabase-js refuses these when the
 *     client uses PKCE, so the session is set here explicitly, and only on
 *     /auth/accept-invite with type=invite (the one flow that sends them).
 *
 * Shapes 2 and 3 carry credentials anyone can put in a link, so they are never
 * used while someone is already signed in here: the page asks first
 * ("conflict"), otherwise a crafted link would silently swap the account.
 * The PKCE code is safe: it needs this browser's own code verifier.
 *
 * Errors come back as `?error=…&error_code=otp_expired&error_description=…`
 * (in the query or the fragment).
 */
export type UrlAuthResult =
  /** `via: "link"` = the session came from credentials in the link itself. */
  | { status: "session"; type: string | null; via: "code" | "link" }
  | { status: "none" }
  /** Someone is already signed in; the link was left unused. */
  | { status: "conflict"; email: string | null }
  | { status: "error"; code: string | null; description: string | null };

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

const AUTH_PARAMS = [
  "code",
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
  "access_token",
  "refresh_token",
  "expires_in",
  "expires_at",
  "token_type",
  "provider_token",
  "provider_refresh_token",
  "sb",
];

/** Removes auth parameters from the address bar so tokens are not left in history. */
function cleanUrl(url: URL) {
  for (const name of AUTH_PARAMS) url.searchParams.delete(name);
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(window.history.state, "", next);
}

async function run(href: string): Promise<UrlAuthResult> {
  const url = new URL(href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const get = (name: string) => query.get(name) ?? hash.get(name);

  const type = get("type");
  const errorCode = get("error_code") ?? get("error");
  if (errorCode || get("error_description")) {
    cleanUrl(url);
    return { status: "error", code: errorCode, description: get("error_description") };
  }

  // Let supabase-js finish its own start-up (PKCE exchange) first.
  const { error: initError } = await supabase.auth.initialize();

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const hasFragmentTokens = Boolean(accessToken && refreshToken);
  // Implicit tokens only come from staff invitations (invite-member → /auth/accept-invite).
  const fragmentAllowed = url.pathname === "/auth/accept-invite" && type === "invite";
  if (hasFragmentTokens && !fragmentAllowed) {
    cleanUrl(url);
    return { status: "none" };
  }

  const tokenHash = query.get("token_hash");
  const hasTokenHash = Boolean(tokenHash && isOtpType(type));

  if (hasFragmentTokens || hasTokenHash) {
    // Never replace an existing session with credentials from a link. The URL is
    // left as it is so the link stays unused if the person chooses to stay.
    const {
      data: { session: previous },
    } = await supabase.auth.getSession();
    if (previous) return { status: "conflict", email: previous.user.email ?? null };
  }

  if (hasFragmentTokens && accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    cleanUrl(url);
    if (error) return { status: "error", code: error.code ?? "link_expired", description: null };
    return { status: "session", type, via: "link" };
  }

  if (tokenHash && isOtpType(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    cleanUrl(url);
    if (error || !data.session) {
      return { status: "error", code: error?.code ?? "link_expired", description: null };
    }
    return { status: "session", type, via: "link" };
  }

  if (query.has("code")) {
    cleanUrl(url);
    if (initError)
      return { status: "error", code: initError.code ?? "link_expired", description: null };
    const { data } = await supabase.auth.getSession();
    return data.session
      ? { status: "session", type, via: "code" }
      : { status: "error", code: "link_expired", description: null };
  }

  return { status: "none" };
}

// Each link can be used once; React StrictMode runs effects twice in
// development, so remember the result per URL.
const inflight = new Map<string, Promise<UrlAuthResult>>();

/** The URL the auth parameters arrived on (before supabase-js tidied it). */
function authHref(): string {
  if (!initialHref) return window.location.href;
  return new URL(initialHref).pathname === window.location.pathname
    ? initialHref
    : window.location.href;
}

export function completeAuthFromUrl(href: string = authHref()): Promise<UrlAuthResult> {
  let promise = inflight.get(href);
  if (!promise) {
    promise = run(href);
    inflight.set(href, promise);
  }
  return promise;
}

/**
 * Runs the link again after a "conflict" was resolved (the previous account
 * signed out), instead of returning the remembered result.
 */
export function retryAuthFromUrl(href: string = authHref()): Promise<UrlAuthResult> {
  inflight.delete(href);
  return completeAuthFromUrl(href);
}
