// Siri, Spotlight and Shortcuts: the intents that open a screen (app-intents/OpenScreenIntents.swift)
// arrive here, and «سبّح» (app-intents/TasbihIntent.swift) adds its counts to the tasbih.
// «الصلاة القادمة» is answered in Swift and never reaches JavaScript.
import * as AppIntents from 'expo-app-intents';

import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTasbihStore } from '@/store/user';

const SCREENS: Record<string, string> = { qibla: '/qibla', adhkar: '/adhkar/now', wird: '/wird' };

export function useSiriIntents(open: (href: string) => void): void {
  AppIntents.useAppIntents(async (pending, newIntent) => {
    // Each «سبّح» counts once: every delivery lists the invocations not yet handled (the new one
    // included), and all of them are removed below.
    const taps = pending.filter((i) => i.name === 'tasbih').length;
    if (taps) {
      const tz = useSettings.getState().location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = civilDateIn(new Date(), tz);
      for (let i = 0; i < taps; i++) useTasbihStore.getState().tap(today);
    }
    // Only the latest invocation matters: an older one would navigate somewhere stale.
    const opens = pending.filter((i) => i.name === 'open');
    const latest = newIntent?.name === 'open' ? newIntent : opens.reduce<(typeof pending)[number] | null>((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null);
    for (const invocation of pending) await AppIntents.removePendingInvocationAsync(invocation.id).catch(() => undefined);
    const screen = latest?.name === 'open' ? SCREENS[String(latest.params.screen)] : undefined;
    if (screen && (newIntent || Date.now() - (latest?.createdAt ?? 0) < 60_000)) open(screen);
  });
}
