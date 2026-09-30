import type { SymbolProps } from '../ui/Symbol';

/**
 * Product categories. Each one carries the warranty length most sellers in the
 * Saudi market give it, which is what the add form pre-fills. It is a starting
 * point, not a promise — the person can always change it per receipt.
 */
export type CategoryId =
  | 'phones'
  | 'computers'
  | 'homeAppliances'
  | 'airConditioning'
  | 'tv'
  | 'furniture'
  | 'powerTools'
  | 'automotive'
  | 'cameras'
  | 'wearables'
  | 'accessories'
  | 'clothing'
  | 'other';

export type Category = {
  id: CategoryId;
  label: string;
  symbol: SymbolProps['name'];
  /** Typical manufacturer warranty, in months. 0 means none is typical. */
  defaultWarrantyMonths: number;
  /** A palette key, resolved against the active theme. */
  tint: 'blue' | 'green' | 'indigo' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow' | 'gray';
};

export const CATEGORIES: Category[] = [
  { id: 'phones', label: 'جوالات وأجهزة لوحية', symbol: 'iphone', defaultWarrantyMonths: 12, tint: 'blue' },
  { id: 'computers', label: 'حاسبات ولابتوبات', symbol: 'laptopcomputer', defaultWarrantyMonths: 12, tint: 'indigo' },
  { id: 'homeAppliances', label: 'أجهزة منزلية', symbol: 'washer', defaultWarrantyMonths: 24, tint: 'teal' },
  { id: 'airConditioning', label: 'تكييف وتبريد', symbol: 'air.conditioner.horizontal', defaultWarrantyMonths: 12, tint: 'green' },
  { id: 'tv', label: 'شاشات وصوتيات', symbol: 'tv', defaultWarrantyMonths: 24, tint: 'purple' },
  { id: 'furniture', label: 'أثاث ومفروشات', symbol: 'sofa', defaultWarrantyMonths: 12, tint: 'orange' },
  { id: 'powerTools', label: 'أدوات ومعدات', symbol: 'wrench.and.screwdriver', defaultWarrantyMonths: 24, tint: 'yellow' },
  { id: 'automotive', label: 'سيارات وقطع غيار', symbol: 'car', defaultWarrantyMonths: 12, tint: 'red' },
  { id: 'cameras', label: 'كاميرات وعدسات', symbol: 'camera', defaultWarrantyMonths: 12, tint: 'pink' },
  { id: 'wearables', label: 'ساعات وأجهزة لبس', symbol: 'applewatch', defaultWarrantyMonths: 12, tint: 'blue' },
  { id: 'accessories', label: 'ملحقات وإكسسوارات', symbol: 'cable.connector', defaultWarrantyMonths: 6, tint: 'gray' },
  { id: 'clothing', label: 'ملابس وأحذية', symbol: 'tshirt', defaultWarrantyMonths: 0, tint: 'pink' },
  { id: 'other', label: 'أخرى', symbol: 'shippingbox', defaultWarrantyMonths: 12, tint: 'gray' },
];

const byId = new Map(CATEGORIES.map((category) => [category.id, category]));

export function category(id: CategoryId): Category {
  return byId.get(id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}
