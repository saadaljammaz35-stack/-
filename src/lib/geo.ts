const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dφ = rad(lat2 - lat1);
  const dλ = rad(lng2 - lng1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}
