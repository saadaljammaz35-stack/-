// The app icon's quick actions (long press) and Siri's intents both open a screen. Used from a
// layout inside the root navigator, so the first navigation has a navigator to land in.
import * as QuickActions from 'expo-quick-actions';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useI18n } from '@/i18n';

import { useSiriIntents } from './siri';

const open = (href: string) => setTimeout(() => router.navigate(href as Href));

function hrefOf(action: QuickActions.Action | null | undefined): string | null {
  const href = action?.params?.href;
  return typeof href === 'string' ? href : null;
}

export function useAppShortcuts() {
  const { tr } = useI18n();
  useSiriIntents(open);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const first = hrefOf(QuickActions.initial);
    if (first) open(first);
    const sub = QuickActions.addListener((action) => {
      const href = hrefOf(action);
      if (href) open(href);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // SF Symbols on iOS; Android shows the app icon.
    const icon = (symbol: string) => (Platform.OS === 'ios' ? `symbol:${symbol}` : null);
    QuickActions.setItems([
      { id: 'qibla', title: tr('القبلة', 'Qibla'), icon: icon('location.north.circle.fill'), params: { href: '/qibla' } },
      { id: 'adhkar', title: tr('أذكار الوقت', 'Adhkar now'), icon: icon('sparkles'), params: { href: '/adhkar/now' } },
      { id: 'wird', title: tr('ورد القرآن', 'Quran portion'), icon: icon('book.fill'), params: { href: '/wird' } },
      { id: 'tasbih', title: tr('المسبحة', 'Tasbih'), icon: icon('circle.grid.3x3.fill'), params: { href: '/tasbih' } },
    ]).catch(() => undefined);
  }, [tr]);
}
