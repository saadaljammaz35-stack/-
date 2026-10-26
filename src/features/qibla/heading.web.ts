// Compass heading in the browser, from the phone's orientation sensors. Browsers report
// magnetic north, so the local declination (World Magnetic Model 2025) is added for true north.
// iOS Safari needs a tap to allow motion access; Android Chrome sends absolute orientation.
import { model as magneticModel } from 'geomagnetism';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSettings } from '@/store/settings';

import { smoothAngle, type Heading, type HeadingState } from './heading.types';

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

const iosPermissionApi = () =>
  typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as PermissionApi).requestPermission === 'function';

function declination(lat: number, lng: number): number {
  try {
    return magneticModel(new Date(), { allowOutOfBoundsModel: true }).point([lat, lng]).decl;
  } catch {
    return 0;
  }
}

/** webkitCompassAccuracy is an error margin in degrees; map it to expo-location's 0–3. */
const accuracyFromDegrees = (deg: number | undefined) => (deg == null || deg < 0 ? 0 : deg <= 10 ? 3 : deg <= 20 ? 2 : deg <= 35 ? 1 : 0);

export function useHeading(enabled: boolean): HeadingState {
  const location = useSettings((s) => s.location);
  const [heading, setHeading] = useState<Heading | null>(null);
  const [error, setError] = useState<HeadingState['error']>(null);
  // Listening starts at once; the permission button only appears when no reading arrives,
  // which is how iOS Safari behaves until the user allows motion access.
  const [quiet, setQuiet] = useState(false);
  const [granted, setGranted] = useState(false);
  const decl = useRef(0);

  useEffect(() => {
    decl.current = location ? declination(location.lat, location.lng) : 0;
  }, [location]);

  const requestPermission = useCallback(() => {
    (DeviceOrientationEvent as unknown as PermissionApi)
      .requestPermission?.()
      .then((r) => (r === 'granted' ? setGranted(true) : setError('denied')))
      .catch(() => setError('denied'));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let smoothed: number | null = null;
    let frame = 0;
    let latest: Heading | null = null;
    let received = false;
    const publish = () => {
      frame = 0;
      if (latest) setHeading(latest);
    };
    const onReading = (magnetic: number, accuracy: number) => {
      if (!received) {
        received = true;
        setQuiet(false);
      }
      smoothed = smoothAngle(smoothed, (magnetic + decl.current + 360) % 360);
      latest = { value: smoothed, accuracy };
      // At most one update per frame, however fast the sensor fires.
      if (!frame) frame = requestAnimationFrame(publish);
    };
    const screenAngle = () => (typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0);
    let compassEvents = false;
    const onCompass = (e: Event) => {
      const ev = e as IOSOrientationEvent;
      if (ev.webkitCompassHeading == null) return;
      compassEvents = true;
      onReading(ev.webkitCompassHeading + screenAngle(), accuracyFromDegrees(ev.webkitCompassAccuracy));
    };
    const onAbsolute = (e: Event) => {
      const ev = e as DeviceOrientationEvent;
      if (ev.alpha == null || compassEvents) return;
      onReading(360 - ev.alpha + screenAngle(), 2);
    };
    window.addEventListener('deviceorientation', onCompass);
    window.addEventListener('deviceorientationabsolute', onAbsolute);
    const hint = setTimeout(() => !received && setQuiet(true), 900);
    const none = setTimeout(() => !received && !iosPermissionApi() && setError('unavailable'), 4000);
    return () => {
      window.removeEventListener('deviceorientation', onCompass);
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      clearTimeout(hint);
      clearTimeout(none);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return { heading, error, needsPermission: enabled && quiet && !granted && iosPermissionApi() && error == null, requestPermission };
}
