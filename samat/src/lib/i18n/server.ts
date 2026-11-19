import 'server-only';
import { cookies, headers } from 'next/headers';
import { dictionaries, isLocale, LOCALE_COOKIE, type Locale } from './index';

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^en\b/i.test(accept) && !/\bar\b/i.test(accept) ? 'en' : 'ar';
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
