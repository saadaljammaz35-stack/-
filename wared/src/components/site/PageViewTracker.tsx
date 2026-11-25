'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { sendEvent } from '@/lib/client/analytics';
import type { Locale } from '@/lib/i18n/config';

export function PageViewTracker({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    sendEvent({ type: 'page_view', path: pathname, locale, referrer: first.current ? document.referrer : undefined });
    first.current = false;
  }, [pathname, locale]);
  return null;
}
