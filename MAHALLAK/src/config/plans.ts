/**
 * Product limits. The one-time purchase unlocks the full app forever. Cloud AI
 * has a running cost per use, so it comes as a FIXED credit included with the
 * purchase (it does not renew monthly): a one-time payment cannot cover
 * unlimited recurring cloud usage. Everything on the device stays unlimited.
 * Numbers are derived in docs/COST-MODEL.md and enforced server-side in
 * supabase/functions/_shared/policy.ts.
 */
export const PLAN = {
  free: {
    maxItems: 25,
    aiRecognitions: 5,
    roomScans: 1,
    cloudBackup: false,
  },
  full: {
    maxItems: Number.POSITIVE_INFINITY,
    /** single-item recognitions included with the purchase */
    aiRecognitions: 80,
    /** background cutouts included (only when a cutout provider is configured) */
    cutouts: 30,
    roomScans: 8,
    queryAssists: 80,
    cloudBackup: true,
    /** compressed photos kept in the private cloud bucket (enforced by storage policy) */
    cloudStorageMb: 1024,
  },
} as const;

/** Store product + entitlement identifiers (configure the same ids in App Store Connect, Play Console and RevenueCat). */
export const STORE = {
  entitlement: 'full_access',
  productId: 'mahallak_full_lifetime',
  /** Price points tested with RevenueCat Experiments (one offering per price). */
  experimentOfferings: ['lifetime_19', 'lifetime_29', 'lifetime_39'],
  defaultOffering: 'lifetime_29',
} as const;
