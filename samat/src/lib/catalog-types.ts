export type CategoryKind = 'burger' | 'shawarma' | 'fries';
export type BuilderType = 'burger' | 'shawarma' | 'simple';
export type IngredientRole = 'base' | 'default' | 'extra' | 'bread_choice';

export interface Category {
  id: string;
  kind: CategoryKind;
  slug: string;
  name_ar: string;
  name_en: string;
  tagline_ar: string | null;
  tagline_en: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface Ingredient {
  id: string;
  slug: string;
  kind: string;
  builder: 'burger' | 'shawarma' | 'any';
  name_ar: string;
  name_en: string;
  image_url: string | null;
  image_top_url: string | null;
  thumb_url: string | null;
  layer_height: number;
  extra_price: number;
  is_active: boolean;
  sort_order: number;
}

export interface ProductIngredient {
  ingredient_id: string;
  role: IngredientRole;
  default_qty: number;
  max_qty: number;
  price_override: number | null;
  is_free: boolean;
  layer_order: number;
  sort_order: number;
  ingredient: Ingredient;
}

export interface Sauce {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  layer_url: string | null;
  top_layer_url: string | null;
  color: string | null;
  price: number;
  is_active: boolean;
}

export interface ProductSauce {
  sauce_id: string;
  included_qty: number;
  is_default: boolean;
  max_qty: number;
  price_override: number | null;
  sort_order: number;
  sauce: Sauce;
}

export interface ProductOption {
  id: string;
  group_id: string;
  name_ar: string;
  name_en: string;
  price_delta: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface OptionGroup {
  id: string;
  name_ar: string;
  name_en: string;
  selection: 'single' | 'multiple';
  is_required: boolean;
  max_select: number;
  sort_order: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  slug: string;
  builder: BuilderType;
  category_kind: CategoryKind;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  image_url: string | null;
  base_price: number;
  is_featured: boolean;
  sort_order: number;
  available: boolean;
  ingredients: ProductIngredient[];
  sauces: ProductSauce[];
  option_groups: OptionGroup[];
}

export interface Availability {
  ingredients: Record<string, boolean>;
  sauces: Record<string, boolean>;
  options: Record<string, boolean>;
  products: Record<string, boolean>;
}

export interface Menu {
  categories: Category[];
  products: Product[];
  availability: Availability;
}

/** What the customer picked for one line. Quantities are absolute (0 = removed). */
export interface Selection {
  breadId: string | null;
  ingredients: Record<string, number>;
  sauces: Record<string, number>;
  options: string[];
  notes: string;
}

export interface StoreState {
  open_now: boolean;
  hours_configured: boolean;
  accepting_orders: boolean;
  busy_mode: boolean;
  busy_extra_minutes: number;
  prep_minutes: number;
  at_capacity: boolean;
  can_order: boolean;
  reason: 'paused' | 'closed' | 'capacity' | null;
  pause_message_ar: string | null;
  pause_message_en: string | null;
  busy_message_ar: string | null;
  busy_message_en: string | null;
}
