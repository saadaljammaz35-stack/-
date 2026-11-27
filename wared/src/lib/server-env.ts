import 'server-only';

/** Server-only secrets. Never import this from a client component. */
export const serverEnv = {
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  /** HMAC secret for form tokens, newsletter tokens and IP hashing. */
  appSecret: process.env.APP_SECRET || undefined,
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM || undefined,
  inboxNotifyEmail: process.env.INBOX_NOTIFY_EMAIL || undefined,
} as const;

export function requireAppSecret(): string {
  const secret = serverEnv.appSecret;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'production') return 'development-only-secret-do-not-use-in-production!!';
  throw new Error('APP_SECRET must be set to at least 32 characters in production.');
}

/** False in production when APP_SECRET is missing: forms then answer "unavailable" instead of failing. */
export function hasAppSecret(): boolean {
  return Boolean(serverEnv.appSecret && serverEnv.appSecret.length >= 32) || process.env.NODE_ENV !== 'production';
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.resendApiKey && serverEnv.emailFrom);
}
