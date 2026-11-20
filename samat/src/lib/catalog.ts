import 'server-only';
import { adminDb } from '@/lib/supabase/admin';
import type { Availability, Category, Menu, Product, StoreState } from './catalog-types';

const PRODUCT_SELECT = `
  id, slug, builder, name_ar, name_en, description_ar, description_en, image_url, base_price, is_active,
  is_available, is_featured, sort_order,
  category:categories!inner(kind, is_active),
  product_ingredients(ingredient_id, role, default_qty, max_qty, price_override, is_free, layer_order, sort_order,
    ingredient:ingredients(id, slug, kind, builder, name_ar, name_en, image_url, image_top_url, thumb_url, layer_height, extra_price, is_active, sort_order)),
  product_sauces(sauce_id, included_qty, is_default, max_qty, price_override, sort_order,
    sauce:sauces(id, slug, name_ar, name_en, image_url, layer_url, top_layer_url, color, price, is_active)),
  option_groups(id, name_ar, name_en, selection, is_required, max_select, sort_order,
    product_options(id, group_id, name_ar, name_en, price_delta, is_default, is_active, sort_order))
`;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function mapProduct(r: Row, av: Availability): Product {
  return {
    id: r.id,
    slug: r.slug,
    builder: r.builder,
    category_kind: r.category.kind,
    name_ar: r.name_ar,
    name_en: r.name_en,
    description_ar: r.description_ar,
    description_en: r.description_en,
    image_url: r.image_url,
    base_price: r.base_price,
    is_featured: r.is_featured,
    sort_order: r.sort_order,
    available: Boolean(av.products[r.id]),
    ingredients: (r.product_ingredients ?? []).map((x: Row) => ({ ...x, ingredient: { ...x.ingredient, layer_height: Number(x.ingredient.layer_height) } })),
    sauces: (r.product_sauces ?? []).sort((a: Row, b: Row) => a.sort_order - b.sort_order),
    option_groups: (r.option_groups ?? [])
      .sort((a: Row, b: Row) => a.sort_order - b.sort_order)
      .map((g: Row) => ({ ...g, options: (g.product_options ?? []).sort((a: Row, b: Row) => a.sort_order - b.sort_order), product_options: undefined })),
  };
}

/**
 * The published menu. Read with the service client but filtered to exactly what the public RLS
 * policy exposes (active, priced, not deleted), plus live availability booleans.
 */
export async function getMenu(): Promise<Menu> {
  const db = adminDb();
  const [cats, prods, avail] = await Promise.all([
    db.from('categories').select('id, kind, slug, name_ar, name_en, tagline_ar, tagline_en, image_url, sort_order')
      .eq('is_active', true).order('sort_order'),
    db.from('products').select(PRODUCT_SELECT).eq('is_active', true).is('deleted_at', null)
      .not('base_price', 'is', null).eq('category.is_active', true).order('sort_order'),
    db.rpc('menu_availability'),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  if (avail.error) throw avail.error;
  const availability = avail.data as Availability;
  return {
    categories: (cats.data ?? []) as Category[],
    products: (prods.data ?? []).map((r) => mapProduct(r, availability)),
    availability,
  };
}

export async function getProductBySlug(slug: string): Promise<{ product: Product; availability: Availability } | null> {
  const db = adminDb();
  const [prod, avail] = await Promise.all([
    db.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('is_active', true).is('deleted_at', null)
      .not('base_price', 'is', null).maybeSingle(),
    db.rpc('menu_availability'),
  ]);
  if (prod.error) throw prod.error;
  if (!prod.data || !(prod.data as Row).category?.is_active) return null;
  const availability = avail.data as Availability;
  return { product: mapProduct(prod.data, availability), availability };
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const db = adminDb();
  const [prod, avail] = await Promise.all([
    db.from('products').select(PRODUCT_SELECT).in('id', ids).is('deleted_at', null),
    db.rpc('menu_availability'),
  ]);
  if (prod.error) throw prod.error;
  return (prod.data ?? []).map((r) => mapProduct(r, avail.data as Availability));
}

export interface PublicSettings {
  branch_name_ar: string;
  branch_name_en: string;
  address_ar: string | null;
  address_en: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  timezone: string;
  opening_hours: Record<string, { open: string; close: string }[]>;
  pickup_instructions_ar: string | null;
  pickup_instructions_en: string | null;
  payment_methods: { creditcard: boolean; applepay: boolean; stcpay: boolean; bank_transfer?: boolean };
  bank_name: string | null;
  bank_account_name: string | null;
  bank_iban: string | null;
  bank_account_number: string | null;
  bank_swift: string | null;
  bank_qr_url: string | null;
  card_networks: string[];
  loyalty_enabled: boolean;
  loyalty_points_per_sar: number;
  loyalty_point_value_halalas: number;
  loyalty_min_redeem_points: number;
  loyalty_expiry_days: number | null;
  loyalty_welcome_points: number;
  vat_enabled: boolean;
  vat_rate_bps: number;
  prices_include_vat: boolean;
  unpaid_order_ttl_minutes: number;
  pickup_screen_enabled: boolean;
  demo_banner: boolean;
}

/** Only the settings that are safe to show to customers (no staff e-mails, no internal limits). */
export async function getPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await adminDb().from('store_settings').select(
    'branch_name_ar, branch_name_en, address_ar, address_en, maps_url, latitude, longitude, phone, timezone, opening_hours, ' +
    'pickup_instructions_ar, pickup_instructions_en, payment_methods, card_networks, loyalty_enabled, loyalty_points_per_sar, ' +
    'loyalty_point_value_halalas, loyalty_min_redeem_points, loyalty_expiry_days, loyalty_welcome_points, vat_enabled, vat_rate_bps, prices_include_vat, ' +
    'unpaid_order_ttl_minutes, pickup_screen_enabled, demo_banner, bank_name, bank_account_name, bank_iban, bank_account_number, bank_swift, bank_qr_url').eq('id', 1).single();
  if (error) throw error;
  const s = data as unknown as PublicSettings;
  return { ...s, loyalty_points_per_sar: Number(s.loyalty_points_per_sar), latitude: s.latitude && Number(s.latitude), longitude: s.longitude && Number(s.longitude) };
}

export async function getStoreState(): Promise<StoreState> {
  const { data, error } = await adminDb().rpc('store_state');
  if (error) throw error;
  return data as StoreState;
}

export interface PublicOffer {
  id: string;
  title_ar: string;
  title_en: string;
  kind: 'percent' | 'fixed';
  value: number;
  min_order: number;
  ends_at: string | null;
}

/** Active automatic offers (no code needed) — shown on the storefront. Coupon codes stay private. */
export async function getActiveOffers(): Promise<PublicOffer[]> {
  const now = new Date().toISOString();
  const { data } = await adminDb().from('coupons')
    .select('id, title_ar, title_en, kind, value, min_order, ends_at, starts_at, audience')
    .eq('is_automatic', true).eq('is_active', true).eq('audience', 'all')
    .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`);
  return (data ?? []) as PublicOffer[];
}
