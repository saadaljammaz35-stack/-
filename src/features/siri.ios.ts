// Siri, Spotlight and Shortcuts: the intents that open a screen (app-intents/OpenScreenIntents.swift)
// arrive here. «الصلاة القادمة» is answered in Swift and never reaches JavaScript.
import * as AppIntents from 'expo-app-intents';

const SCREENS: Record<string, string> = { qibla: '/qibla', adhkar: '/adhkar/now', wird: '/wird' };

export function useSiriIntents(open: (href: string) => void): void {
  AppIntents.useAppIntents(async (pending, newIntent) => {
    // Only the latest invocation matters: an older one would navigate somewhere stale.
    const latest = newIntent ?? pending.reduce<(typeof pending)[number] | null>((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null);
    for (const invocation of pending) await AppIntents.removePendingInvocationAsync(invocation.id).catch(() => undefined);
    const screen = latest?.name === 'open' ? SCREENS[String(latest.params.screen)] : undefined;
    if (screen && (newIntent || Date.now() - (latest?.createdAt ?? 0) < 60_000)) open(screen);
  });
}
