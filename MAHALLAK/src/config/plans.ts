/**
 * Product limits. The one-time purchase unlocks the full app forever; cloud AI is
 * offered with a monthly fair-use quota so its running cost stays covered
 * (see docs/COST-MODEL.md). Everything that runs on the device stays unlimited.
 */
export const PLAN = {
  free: {
    maxItems: 25,
    aiRecognitionsPerMonth: 5,
    cloudBackup: false,
  },
  full: {
    maxItems: Number.POSITIVE_INFINITY,
    /** single-item recognition + background removal + room scans, combined */
    aiRecognitionsPerMonth: 150,
    roomScansPerMonth: 20,
    aiQueryFallbacksPerMonth: 300,
    cloudBackup: true,
    /** compressed photos kept in the private cloud bucket */
    cloudStorageMb: 2048,
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
