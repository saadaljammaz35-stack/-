import { cookies, headers } from "next/headers";
import type { Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const c = jar.get("lang")?.value;
  if (c === "ar" || c === "en") return c;
  const al = (await headers()).get("accept-language") ?? "";
  return /^en\b/i.test(al.trim()) ? "en" : "ar";
}
