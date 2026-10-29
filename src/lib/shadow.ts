// «ظل العصر»: shadows as multiples of the object's height. Asr begins when an object's shadow
// equals its height (twice its height for the Hanafis) beyond the shadow it had at noon.
import { solarCoordinates, sunPosition } from './sun';

const rad = (d: number) => (d * Math.PI) / 180;

/** Shadow length as a multiple of the object's height, for a sun at `altitude` degrees; null at night. */
export function shadowRatio(altitude: number): number | null {
  return altitude > 0.5 ? 1 / Math.tan(rad(altitude)) : null;
}

/** The shortest shadow of the day (at the transit), as a multiple of the height. */
export function noonShadowRatio(lat: number, declination: number): number {
  return Math.tan(rad(Math.abs(lat - declination)));
}

export type ShadowNow = {
  /** Current shadow / height, or null when the sun is down. */
  ratio: number | null;
  /** Noon shadow / height for the day. */
  noon: number;
  /** Shadow / height at which Asr begins. */
  asr: number;
  /** The sun's azimuth: the shadow points the opposite way. */
  azimuth: number;
  altitude: number;
};

export function shadowAt(at: Date, lat: number, lng: number, madhab: 'shafi' | 'hanafi'): ShadowNow {
  const { azimuth, altitude } = sunPosition(at, lat, lng);
  const noon = noonShadowRatio(lat, solarCoordinates(at).declination);
  return { ratio: shadowRatio(altitude), noon, asr: noon + (madhab === 'hanafi' ? 2 : 1), azimuth, altitude };
}
