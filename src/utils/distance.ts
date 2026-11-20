export type Coords = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line ("as the crow flies") distance in kilometres. Roads are usually a little longer. */
export function distanceKm(from: Coords, to: Coords) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "300 m away", "1.4 km away", "12 km away". */
export function formatDistance(km: number) {
  const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metres < 1000) return `${metres} m away`;
  const tenths = Math.round(km * 10) / 10;
  return tenths < 10 ? `${tenths.toFixed(1)} km away` : `${Math.round(km)} km away`;
}

/** Distance from the person to a restaurant, or null when either position is unknown. */
export function distanceTo(user: Coords | null, place: { latitude: number | null; longitude: number | null }) {
  if (!user || place.latitude == null || place.longitude == null) return null;
  return distanceKm(user, { latitude: place.latitude, longitude: place.longitude });
}
