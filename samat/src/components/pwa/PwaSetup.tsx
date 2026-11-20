'use client';
import { useEffect } from 'react';

/** Registers the service worker (installable app + notifications). Safe to render once per page. */
export function PwaSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* unsupported or blocked: the site works without it */ });
  }, []);
  return null;
}
