import type { MessageKey } from "@/i18n";

/**
 * Major Saudi cities offered in forms. `value` is what gets stored
 * (organizations.city, English, stable across languages); `label` is shown.
 */
export const SAUDI_CITIES = [
  { value: "Riyadh", label: "onboarding.city_riyadh" },
  { value: "Jeddah", label: "onboarding.city_jeddah" },
  { value: "Makkah", label: "onboarding.city_makkah" },
  { value: "Madinah", label: "onboarding.city_madinah" },
  { value: "Dammam", label: "onboarding.city_dammam" },
  { value: "Al Khobar", label: "onboarding.city_khobar" },
  { value: "Dhahran", label: "onboarding.city_dhahran" },
  { value: "Al Ahsa", label: "onboarding.city_ahsa" },
  { value: "Qatif", label: "onboarding.city_qatif" },
  { value: "Jubail", label: "onboarding.city_jubail" },
  { value: "Taif", label: "onboarding.city_taif" },
  { value: "Tabuk", label: "onboarding.city_tabuk" },
  { value: "Abha", label: "onboarding.city_abha" },
  { value: "Khamis Mushait", label: "onboarding.city_khamis" },
  { value: "Buraidah", label: "onboarding.city_buraidah" },
  { value: "Unaizah", label: "onboarding.city_unaizah" },
  { value: "Hail", label: "onboarding.city_hail" },
  { value: "Jazan", label: "onboarding.city_jazan" },
  { value: "Najran", label: "onboarding.city_najran" },
  { value: "Yanbu", label: "onboarding.city_yanbu" },
  { value: "Al Baha", label: "onboarding.city_baha" },
  { value: "Arar", label: "onboarding.city_arar" },
  { value: "Sakaka", label: "onboarding.city_sakaka" },
] as const satisfies ReadonlyArray<{ value: string; label: MessageKey }>;

export const OTHER_CITY = "__other__";

/** Message key for a stored city value, or null for a free-text city. */
export function cityLabelKey(value: string | null | undefined): MessageKey | null {
  return SAUDI_CITIES.find((city) => city.value === value)?.label ?? null;
}
