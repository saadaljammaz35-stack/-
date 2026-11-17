import { Platform } from 'react-native';

import { env } from '@/config/env';
import { STORE } from '@/config/plans';

/**
 * One-time purchase ("مَحَلّك كامل") through the App Store / Google Play, via
 * RevenueCat (receipt validation, restore, cross-platform entitlement, and price
 * experiments between 19 / 29 / 39 SAR). There is no simulated purchase path:
 * without store keys the purchase screen says the store is unavailable.
 */

export interface StoreOffer {
  identifier: string;
  priceString: string;
  title: string;
  /** Opaque package passed back to purchase(). */
  pkg: unknown;
}

export type PurchaseErrorCode = 'not_configured' | 'cancelled' | 'not_allowed' | 'network' | 'failed';
export class PurchaseError extends Error {
  constructor(public code: PurchaseErrorCode, message?: string) {
    super(message ?? code);
  }
}

function apiKey(): string {
  if (Platform.OS === 'ios') return env.revenueCatIosKey;
  if (Platform.OS === 'android') return env.revenueCatAndroidKey;
  return '';
}

export const isStoreConfigured = () => Boolean(apiKey());

let configured = false;
async function sdk() {
  if (!isStoreConfigured()) throw new PurchaseError('not_configured');
  const mod = await import('react-native-purchases');
  const Purchases = mod.default;
  if (!configured) {
    Purchases.configure({ apiKey: apiKey() });
    configured = true;
  }
  return { Purchases, mod };
}

/** Links purchases to the signed-in account so they follow the user across devices. */
export async function identify(userId: string | null): Promise<void> {
  if (!isStoreConfigured()) return;
  const { Purchases } = await sdk();
  if (userId) await Purchases.logIn(userId);
  else if (!(await Purchases.getCustomerInfo()).originalAppUserId.startsWith('$RCAnonymousID')) await Purchases.logOut();
}

export async function hasFullAccess(): Promise<boolean> {
  if (!isStoreConfigured()) return false;
  try {
    const { Purchases } = await sdk();
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[STORE.entitlement]);
  } catch {
    return false;
  }
}

export async function loadOffer(): Promise<StoreOffer | null> {
  const { Purchases } = await sdk();
  const offerings = await Purchases.getOfferings();
  // RevenueCat Experiments decide which price offering is "current" for this user.
  const offering = offerings.current ?? offerings.all[STORE.defaultOffering] ?? null;
  const pkg = offering?.lifetime ?? offering?.availablePackages[0] ?? null;
  if (!pkg) return null;
  return { identifier: pkg.identifier, priceString: pkg.product.priceString, title: pkg.product.title, pkg };
}

function mapError(e: unknown): PurchaseError {
  const err = e as { userCancelled?: boolean; code?: string; message?: string };
  if (err?.userCancelled) return new PurchaseError('cancelled');
  if (err?.code === 'PURCHASE_NOT_ALLOWED_ERROR' || err?.code === '3') return new PurchaseError('not_allowed', err.message);
  if (err?.code === 'NETWORK_ERROR' || err?.code === '10') return new PurchaseError('network', err.message);
  return new PurchaseError('failed', err?.message);
}

export async function purchase(offer: StoreOffer): Promise<boolean> {
  const { Purchases } = await sdk();
  try {
    const result = await Purchases.purchasePackage(offer.pkg as Parameters<typeof Purchases.purchasePackage>[0]);
    return Boolean(result.customerInfo.entitlements.active[STORE.entitlement]);
  } catch (e) {
    throw mapError(e);
  }
}

export async function restore(): Promise<boolean> {
  const { Purchases } = await sdk();
  try {
    const info = await Purchases.restorePurchases();
    return Boolean(info.entitlements.active[STORE.entitlement]);
  } catch (e) {
    throw mapError(e);
  }
}
