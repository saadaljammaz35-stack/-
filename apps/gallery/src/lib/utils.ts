import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn's class helper. Every component added by `npx shadcn add` imports it,
 * so it exists from the start even though MorphGallery does not need it: a
 * missing `@/lib/utils` is the first thing that breaks on the second component.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
