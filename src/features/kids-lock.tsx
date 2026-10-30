// «وضع الطفل»: while the kids area is locked, any other screen sends the child back to it.
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { useKidsStore } from '@/store/user';

export const isKidsPath = (path: string) => path === '/kids' || path.startsWith('/kids/');

export function KidsLockGuard() {
  const locked = useKidsStore((s) => s.lockPin != null);
  const pathname = usePathname();
  const ready = useRootNavigationState()?.key != null;

  useEffect(() => {
    if (ready && locked && !isKidsPath(pathname)) router.replace('/kids');
  }, [ready, locked, pathname]);

  // The hardware back button cannot leave the kids home while it is locked.
  useEffect(() => {
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => pathname === '/kids');
    return () => sub.remove();
  }, [locked, pathname]);

  return null;
}
