// Compass heading on iOS and Android, from the platform's location service (already corrected
// to true north). Readings are smoothed, and the screen only re-renders when the needle moves.
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { smoothAngle, type Heading, type HeadingState } from './heading.types';

export function useHeading(enabled: boolean): HeadingState {
  const [heading, setHeading] = useState<Heading | null>(null);
  const [error, setError] = useState<HeadingState['error']>(null);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    let smoothed: number | null = null;
    let shown: Heading | null = null;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && !(await Location.requestForegroundPermissionsAsync()).granted) {
        if (alive) setError('denied');
        return;
      }
      const s = await Location.watchHeadingAsync((h) => {
        const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        smoothed = smoothAngle(smoothed, raw);
        // Skip updates the eye cannot see; each one redraws the screen.
        if (shown && Math.abs(((smoothed - shown.value + 540) % 360) - 180) < 0.4 && shown.accuracy === h.accuracy) return;
        shown = { value: smoothed, accuracy: h.accuracy };
        setHeading(shown);
      });
      if (alive) sub = s;
      else s.remove();
    })().catch(() => alive && setError('unavailable'));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [enabled]);
  return { heading, error, needsPermission: false, requestPermission: () => undefined };
}
