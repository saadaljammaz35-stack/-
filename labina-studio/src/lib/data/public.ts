import "server-only";
import { cache } from "react";
import { getPublicClient } from "../supabase/public";
import { DEFAULT_FAQS, DEFAULT_HOME_TEXT, DEFAULT_HOURS, DEFAULT_SERVICES, DEFAULT_VALUES } from "../defaults";
import {
  parseBooking,
  parseContact,
  parseHome,
  type BookingSettings,
  type ContactSettings,
  type HomeSettings,
} from "../settings";
import type { Faq, GalleryItem, Service, Testimonial, WorkingHour } from "../types";
import { isSupabaseConfigured } from "../env";

export type SiteData = {
  connected: boolean;
  contact: ContactSettings;
  home: HomeSettings;
  booking: BookingSettings;
  hours: WorkingHour[];
  blockedDates: string[];
};

function logError(scope: string, error: unknown) {
  console.error(`[data:${scope}]`, error instanceof Error ? error.message : error);
}

function withHomeFallbacks(home: HomeSettings, connected: boolean): HomeSettings {
  if (connected) return home;
  return {
    ...home,
    about_story: home.about_story || DEFAULT_HOME_TEXT.about_story,
    about_mission: home.about_mission || DEFAULT_HOME_TEXT.about_mission,
    about_vision: home.about_vision || DEFAULT_HOME_TEXT.about_vision,
    values: home.values.length ? home.values : DEFAULT_VALUES,
    cta_text: home.cta_text || DEFAULT_HOME_TEXT.cta_text,
    seo_description: home.seo_description || DEFAULT_HOME_TEXT.seo_description,
  };
}

export const getSiteData = cache(async (): Promise<SiteData> => {
  const supabase = getPublicClient();
  const fallback: SiteData = {
    connected: false,
    contact: parseContact({}),
    home: withHomeFallbacks(parseHome({}), false),
    booking: parseBooking({}),
    hours: DEFAULT_HOURS,
    blockedDates: [],
  };
  if (!supabase) return fallback;

  const [settingsRes, hoursRes, blockedRes] = await Promise.all([
    supabase.from("site_settings").select("key, value").in("key", ["contact", "home", "booking"]),
    supabase.from("working_hours").select("weekday, is_open, open_time, close_time").order("weekday"),
    supabase.from("blocked_dates").select("day").gte("day", new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
  ]);

  if (settingsRes.error || hoursRes.error) {
    logError("site", settingsRes.error ?? hoursRes.error);
    return fallback;
  }
  const byKey = Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, r.value]));
  return {
    connected: true,
    contact: parseContact(byKey.contact),
    home: withHomeFallbacks(parseHome(byKey.home), true),
    booking: parseBooking(byKey.booking),
    hours: hoursRes.data?.length ? (hoursRes.data as WorkingHour[]) : DEFAULT_HOURS,
    blockedDates: (blockedRes.data ?? []).map((r) => r.day),
  };
});

export const getServices = cache(async (): Promise<Service[]> => {
  const supabase = getPublicClient();
  if (!supabase) return DEFAULT_SERVICES;
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) {
    logError("services", error);
    return [];
  }
  return data.map((s) => ({ ...s, price: s.price === null ? null : Number(s.price) })) as Service[];
});

export const getServiceBySlug = cache(async (slug: string): Promise<Service | null> => {
  const services = await getServices();
  return services.find((s) => s.slug === slug) ?? null;
});

export const getGallery = cache(async (): Promise<GalleryItem[]> => {
  const supabase = getPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) {
    logError("gallery", error);
    return [];
  }
  return data as GalleryItem[];
});

export const getTestimonials = cache(async (): Promise<Testimonial[]> => {
  const supabase = getPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) {
    logError("testimonials", error);
    return [];
  }
  return data as Testimonial[];
});

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const supabase = getPublicClient();
  if (!supabase) return DEFAULT_FAQS;
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at");
  if (error) {
    logError("faqs", error);
    return [];
  }
  return data as Faq[];
});

export { isSupabaseConfigured };
