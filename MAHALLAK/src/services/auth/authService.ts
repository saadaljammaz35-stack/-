import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { env, isGoogleConfigured } from '@/config/env';
import { getSupabase } from '@/services/supabase';

export type AuthErrorCode =
  | 'backend_not_configured'
  | 'provider_not_configured'
  | 'cancelled'
  | 'invalid_phone'
  | 'invalid_code'
  | 'network'
  | 'unavailable'
  | 'unknown';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

/**
 * Normalizes Saudi mobile numbers to E.164 (+9665XXXXXXXX). International numbers
 * written with "+" or "00" are accepted as long as they look like E.164.
 */
export function normalizePhone(input: string): string | null {
  const digits = input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s()-]/g, '');
  let d = digits;
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (/^05\d{8}$/.test(d)) return `+966${d.slice(1)}`;
  if (/^5\d{8}$/.test(d)) return `+966${d}`;
  if (/^9665\d{8}$/.test(d)) return `+${d}`;
  if (/^\+9665\d{8}$/.test(d)) return d;
  if (/^\+966/.test(d)) return null; // Saudi prefix but not a mobile number
  if (/^\+[1-9]\d{7,14}$/.test(d)) return d;
  return null;
}

function requireClient(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new AuthError('backend_not_configured');
  return c;
}

function mapSupabaseError(error: { message?: string; status?: number } | null): AuthError {
  const msg = error?.message ?? '';
  if (/token|otp|expired|invalid/i.test(msg)) return new AuthError('invalid_code', msg);
  if (/network|fetch/i.test(msg)) return new AuthError('network', msg);
  return new AuthError('unknown', msg);
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<Session> {
  const client = requireClient();
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthError('cancelled');
    throw new AuthError('unavailable', String(e));
  }
  if (!credential.identityToken) throw new AuthError('unknown', 'no identity token');
  const { data, error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.session) throw mapSupabaseError(error);
  // Apple shares the name only on the first sign-in: keep it in the profile.
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (fullName) await client.auth.updateUser({ data: { full_name: fullName } });
  return data.session;
}

export async function signInWithGoogle(): Promise<Session> {
  const client = requireClient();
  if (!isGoogleConfigured()) throw new AuthError('provider_not_configured');
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: env.googleWebClientId, iosClientId: env.googleIosClientId || undefined });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new AuthError('cancelled');
    const idToken = response.data.idToken;
    if (!idToken) throw new AuthError('unknown', 'no id token');
    const { data, error } = await client.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error || !data.session) throw mapSupabaseError(error);
    return data.session;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError('unavailable', String(e));
  }
}

export async function sendPhoneCode(rawPhone: string): Promise<string> {
  const client = requireClient();
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new AuthError('invalid_phone');
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) throw mapSupabaseError(error);
  return phone;
}

export async function verifyPhoneCode(phone: string, code: string): Promise<Session> {
  const client = requireClient();
  const token = code.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
  if (token.length < 4 || token.length > 8) throw new AuthError('invalid_code');
  const { data, error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error || !data.session) throw mapSupabaseError(error);
  return data.session;
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
  if (Platform.OS !== 'web' && isGoogleConfigured()) {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // not signed in with Google
    }
  }
}

export async function currentSession(): Promise<Session | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}
