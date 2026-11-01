export type BrandColor = "coral" | "sun" | "plum" | "lavender" | "teal";

export type Service = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  features: string[];
  price: number | null;
  price_note: string | null;
  duration_minutes: number;
  image_url: string | null;
  color: BrandColor;
  icon: string;
  is_active: boolean;
  is_bookable: boolean;
  sort_order: number;
};

export type GalleryCategory = "newborn" | "kids" | "family" | "birthday" | "events";
export type GalleryShape = "square" | "portrait" | "tall" | "landscape";

export type GalleryItem = {
  id: string;
  image_url: string;
  storage_path: string | null;
  title: string | null;
  alt: string | null;
  category: GalleryCategory;
  shape: GalleryShape;
  width: number | null;
  height: number | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
};

export type Testimonial = {
  id: string;
  author_name: string;
  author_label: string | null;
  content: string;
  rating: number;
  service_id: string | null;
  is_published: boolean;
  sort_order: number;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  is_published: boolean;
  sort_order: number;
};

export type WorkingHour = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

/** Shape returned by the booking RPC functions */
export type BookingPayload = {
  id?: string;
  reference: string;
  manage_token?: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string | null;
  children_count: number;
  notes?: string | null;
  can_cancel?: boolean;
  cancel_notice_hours?: number;
};

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
