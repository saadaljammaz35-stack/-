import type { BookingStatus, BrandColor, GalleryCategory, GalleryShape } from "./types";

export const SITE_NAME = "لَبِنة";
export const SITE_TAGLINE = "استوديو الطفولة";

export const NAV_LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/services", label: "خدماتنا" },
  { href: "/gallery", label: "معرض الصور" },
  { href: "/about", label: "من نحن" },
  { href: "/faq", label: "الأسئلة الشائعة" },
  { href: "/contact", label: "تواصل معنا" },
] as const;

export const GALLERY_CATEGORIES: { value: GalleryCategory; label: string }[] = [
  { value: "newborn", label: "المواليد" },
  { value: "kids", label: "الأطفال" },
  { value: "family", label: "العائلات" },
  { value: "birthday", label: "أعياد الميلاد" },
  { value: "events", label: "المناسبات" },
];

export const CATEGORY_LABEL: Record<GalleryCategory, string> = Object.fromEntries(
  GALLERY_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<GalleryCategory, string>;

export const GALLERY_SHAPES: { value: GalleryShape; label: string; ratio: string }[] = [
  { value: "square", label: "مربع", ratio: "1 / 1" },
  { value: "portrait", label: "طولي", ratio: "4 / 5" },
  { value: "tall", label: "طولي عالٍ", ratio: "3 / 5" },
  { value: "landscape", label: "عرضي", ratio: "4 / 3" },
];

export const SHAPE_RATIO: Record<GalleryShape, string> = {
  square: "1 / 1",
  portrait: "4 / 5",
  tall: "3 / 5",
  landscape: "4 / 3",
};

export const STATUS_META: Record<BookingStatus, { label: string; className: string; dot: string }> = {
  pending: { label: "جديد", className: "bg-sun-soft text-ink", dot: "bg-sun" },
  confirmed: { label: "مؤكد", className: "bg-teal-soft text-teal-ink", dot: "bg-teal" },
  completed: { label: "مكتمل", className: "bg-lavender-soft text-plum", dot: "bg-lavender" },
  cancelled: { label: "ملغى", className: "bg-coral-soft text-coral-ink", dot: "bg-coral" },
};

/** Index = Postgres extract(dow) (0 = Sunday) */
export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
/** Display order for an Arabic week that starts on Saturday */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export const BRAND_COLORS: { value: BrandColor; label: string; hex: string }[] = [
  { value: "coral", label: "مرجاني", hex: "#DE7968" },
  { value: "sun", label: "أصفر", hex: "#EFC95E" },
  { value: "plum", label: "بنفسجي", hex: "#49285D" },
  { value: "lavender", label: "لافندر", hex: "#929FCC" },
  { value: "teal", label: "تركوازي", hex: "#419797" },
];

/** Tailwind classes per brand color (kept literal so Tailwind can see them) */
export const COLOR_CLASSES: Record<BrandColor, { bg: string; text: string; soft: string; onBg: string }> = {
  coral: { bg: "bg-coral", text: "text-coral-ink", soft: "bg-coral-soft", onBg: "text-ink" },
  sun: { bg: "bg-sun", text: "text-ink", soft: "bg-sun-soft", onBg: "text-ink" },
  plum: { bg: "bg-plum", text: "text-plum", soft: "bg-lavender-soft", onBg: "text-paper" },
  lavender: { bg: "bg-lavender", text: "text-plum", soft: "bg-lavender-soft", onBg: "text-ink" },
  teal: { bg: "bg-teal", text: "text-teal-ink", soft: "bg-teal-soft", onBg: "text-ink" },
};

export const SERVICE_ICONS = [
  { value: "camera", label: "كاميرا" },
  { value: "moon", label: "هلال (مواليد)" },
  { value: "smile", label: "ابتسامة" },
  { value: "cake", label: "كعكة" },
  { value: "users", label: "عائلة" },
  { value: "sparkles", label: "نجوم" },
  { value: "package", label: "منتج" },
  { value: "book", label: "ألبوم" },
  { value: "palette", label: "ألوان" },
  { value: "heart", label: "قلب" },
  { value: "star", label: "نجمة" },
] as const;
