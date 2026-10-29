/// <reference types="node" />
// Every in-app link that is built from data (notifications, home shortcuts, widgets) must
// point at a screen that exists under src/app.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_NOTIFICATION_SETTINGS, planNotifications } from '../notification-plan';
import { DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';

const APP = join(__dirname, '../../app');

/** Resolves a pathname like "/adhkar/morning" against the file-based routes. */
function routeExists(pathname: string): boolean {
  const segments = pathname.split('?')[0].split('/').filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (!rest.length) return existsSync(join(dir, 'index.tsx')) || readdirSync(dir).some((f) => /^\(.+\)$/.test(f) && walk(join(dir, f), []));
    const [head, ...tail] = rest;
    const entries = readdirSync(dir);
    if (!tail.length && entries.includes(`${head}.tsx`)) return true;
    if (entries.includes(head) && statSync(join(dir, head)).isDirectory() && walk(join(dir, head), tail)) return true;
    // Route groups such as (tabs) do not appear in the URL.
    if (entries.filter((e) => /^\(.+\)$/.test(e)).some((g) => walk(join(dir, g), rest))) return true;
    // Dynamic segments: [id].tsx or [id]/ directories.
    const dynFile = entries.find((e) => /^\[[^\]]+\]\.tsx$/.test(e));
    if (!tail.length && dynFile) return true;
    const dynDir = entries.find((e) => /^\[[^\]]+\]$/.test(e));
    return Boolean(dynDir && walk(join(dir, dynDir), tail));
  };
  return walk(APP, segments);
}

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };

describe('in-app routes', () => {
  it('resolves known screens and rejects unknown ones', () => {
    expect(routeExists('/')).toBe(true);
    expect(routeExists('/qibla')).toBe(true);
    expect(routeExists('/adhkar/morning')).toBe(true);
    expect(routeExists('/hadith/enc/12')).toBe(true);
    expect(routeExists('/adhkar/now')).toBe(true);
    expect(routeExists('/wird')).toBe(true);
    expect(routeExists('/between')).toBe(true);
    expect(routeExists('/duas/mine')).toBe(true);
    expect(routeExists('/quran/surah/18')).toBe(false);
  });

  it('every notification opens an existing screen', () => {
    const settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      sleepAdhkar: { enabled: true, at: { hour: 22, minute: 0 } },
      quranReminder: { enabled: true, at: { hour: 20, minute: 0 } },
      fasting: { enabled: true, at: { hour: 21, minute: 0 } },
      fridayKahf: { ...DEFAULT_NOTIFICATION_SETTINGS.fridayKahf, enabled: true },
      qiyam: { enabled: true },
      seasons: { enabled: true },
      fridayHour: { enabled: true },
    };
    const plan = planNotifications({
      now: new Date('2026-10-22T08:00:00Z'),
      place: riyadh,
      prayer: DEFAULT_PRAYER_SETTINGS,
      settings,
      khatmas: [{ id: 'k', name: 'ختمة', at: { hour: 19, minute: 0 }, portion: () => ({ from: 1, to: 20 }) }],
      limit: 500,
      days: 10,
    });
    const routes = [...new Set(plan.map((p) => p.route))];
    expect(routes.length).toBeGreaterThan(3);
    for (const r of routes) expect([r, routeExists(r)]).toEqual([r, true]);
  });

  it('home shortcuts and widget links open existing screens', () => {
    const sources = ['../../features/shortcuts.ts', '../../features/app-shortcuts.ts', '../../features/siri.ios.ts', '../../widgets/index.ios.tsx', '../../widgets/index.android.tsx', '../../widgets/live-activity.ios.tsx', '../../features/live-countdown.ts'].map((f) =>
      readFileSync(join(__dirname, f), 'utf8'),
    );
    const routes = sources.flatMap((s) => [
      ...[...s.matchAll(/(?:route|href): '(\/[^']*)'/g)].map((m) => m[1]),
      ...[...s.matchAll(/[a-z]+: '(\/[a-z/]+)'/g)].map((m) => m[1]),
      ...[...s.matchAll(/maallah:\/\/([^'"]*)/g)].map((m) => `/${m[1]}`),
    ]);
    expect(routes.length).toBeGreaterThan(10);
    for (const r of new Set(routes)) expect([r, routeExists(r)]).toEqual([r, true]);
  });
});
