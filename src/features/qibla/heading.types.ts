export type Heading = {
  /** Degrees clockwise from true north. */
  value: number;
  /** 0 (unreliable) to 3 (high), as reported by expo-location; web readings are mapped to it. */
  accuracy: number;
};

export type HeadingState = {
  heading: Heading | null;
  error: 'denied' | 'unavailable' | null;
  /** iOS Safari only shows motion data after the user allows it from a tap. */
  needsPermission: boolean;
  requestPermission: () => void;
};

/** Moves `current` towards `target` along the shorter way round, for a steady needle. */
export function smoothAngle(current: number | null, target: number, factor = 0.25): number {
  if (current == null) return target;
  const delta = ((target - current + 540) % 360) - 180;
  return (current + delta * factor + 360) % 360;
}
