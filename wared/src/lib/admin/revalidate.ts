import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import { CONTENT_CACHE_TAG } from '@/lib/supabase/public';

/** Refreshes every public page, feed and the sitemap after content changes. */
export function revalidateContent() {
  updateTag(CONTENT_CACHE_TAG);
  revalidatePath('/', 'layout');
}
