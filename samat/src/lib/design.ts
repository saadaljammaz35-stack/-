import 'server-only';
import { cookies } from 'next/headers';

/** Storefront design. 'studio' is the new Apple-style design, previewed with /?design=new and left with /?design=old. */
export type Design = 'classic' | 'studio';
export const DESIGN_COOKIE = 'samat_design';
/** What visitors see without a preview cookie. Switch to 'studio' once the new design is approved. */
export const DEFAULT_DESIGN: Design = 'classic';

export async function getDesign(): Promise<Design> {
  const v = (await cookies()).get(DESIGN_COOKIE)?.value;
  return v === 'studio' || v === 'classic' ? v : DEFAULT_DESIGN;
}
