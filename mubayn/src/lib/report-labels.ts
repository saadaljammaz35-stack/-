import type { Locale } from "./i18n";

const AREAS: Record<string, [string, string]> = {
  screen: ["الشاشة", "Screen"],
  front: ["الواجهة", "Front"],
  back: ["الخلف", "Back"],
  frame_edges: ["الإطار والأطراف", "Frame and edges"],
  camera: ["الكاميرا", "Camera"],
  ports: ["المنافذ", "Ports"],
  buttons: ["الأزرار", "Buttons"],
  speaker_mic: ["السماعة والميكروفون", "Speaker and mic"],
  keyboard: ["لوحة المفاتيح", "Keyboard"],
  trackpad: ["لوحة اللمس", "Trackpad"],
  hinge: ["المفصلة", "Hinge"],
  display_bezel: ["إطار الشاشة", "Display bezel"],
  accessories: ["الملحقات", "Accessories"],
  identity_label: ["ملصق التعريف", "Identity label"],
  packaging: ["العلبة", "Packaging"],
  other: ["أخرى", "Other"],
};

export function areaLabel(area: string, locale: Locale): string {
  const a = AREAS[area];
  return a ? a[locale === "ar" ? 0 : 1] : area;
}

export function mmss(ms: number | null): string {
  if (ms == null) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const SEVERITY_ORDER = { critical: 0, major: 1, moderate: 2, minor: 3, info: 4 } as const;
