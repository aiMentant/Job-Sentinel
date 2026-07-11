/**
 * locationProximity.ts
 * Core utility for proximity-based location sorting and distance calculation.
 * Used by the search engine to order target locations by distance from the
 * user's selected base city, enabling efficient radius-expansion searches.
 */

export type GeoCoords = { lat: number; lon: number };
export type RankedLocation = { location: string; distanceMiles: number; coords?: GeoCoords };

// ─── In-memory geocoding cache (clears on server restart) ────────────────────
const memCache = new Map<string, GeoCoords | null>();

/**
 * Haversine formula — returns distance in miles between two lat/lon points.
 */
export function haversineDistanceMiles(a: GeoCoords, b: GeoCoords): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Geocode a location string using Nominatim (OpenStreetMap).
 * Results are cached in memory. Returns null on failure or timeout.
 */
export async function geocodeLocation(location: string): Promise<GeoCoords | null> {
  const key = location.toLowerCase().trim();
  if (memCache.has(key)) return memCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "JobSentinel/1.0 (job-sentinel-app)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      memCache.set(key, null);
      return null;
    }
    const data = await res.json();
    if (!data || data.length === 0) {
      memCache.set(key, null);
      return null;
    }
    const coords: GeoCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    memCache.set(key, coords);
    return coords;
  } catch {
    memCache.set(key, null);
    return null;
  }
}

/**
 * Rank a list of target locations by proximity to a base location.
 * Locations that cannot be geocoded are appended at the end (in original order).
 * 
 * @param baseLocation  - The user's chosen base city (e.g. "Edgewater, FL")
 * @param locations     - All target locations from the user's profile
 * @returns Sorted array of RankedLocation objects, closest first.
 */
export async function rankLocationsByProximity(
  baseLocation: string,
  locations: string[]
): Promise<RankedLocation[]> {
  const baseCoords = await geocodeLocation(baseLocation);

  const results: RankedLocation[] = [];
  const unresolvable: RankedLocation[] = [];

  await Promise.allSettled(
    locations.map(async (loc) => {
      if (!baseCoords) {
        // Can't sort without a base — preserve original order
        unresolvable.push({ location: loc, distanceMiles: Infinity });
        return;
      }
      // Small delay to respect Nominatim's 1 req/sec rate limit
      await new Promise((r) => setTimeout(r, 200));
      const coords = await geocodeLocation(loc);
      if (coords) {
        results.push({
          location: loc,
          distanceMiles: haversineDistanceMiles(baseCoords, coords),
          coords,
        });
      } else {
        unresolvable.push({ location: loc, distanceMiles: Infinity });
      }
    })
  );

  results.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return [...results, ...unresolvable];
}

/**
 * Simple heuristic to detect if a location string represents a broad region
 * (e.g. "United States", "US", "Florida") vs. a specific city.
 */
export function isBroadRegion(location: string): boolean {
  const l = location.toLowerCase().trim();
  const broadKeywords = [
    "united states", "usa", "u.s.", "us", "america",
    "united kingdom", "uk", "gb", "britain",
    "canada", "australia",
    "florida", "california", "texas", "new york", "georgia", "ohio",
    "remote", "anywhere", "worldwide", "nationwide", "national",
  ];
  return broadKeywords.some((kw) => l === kw || l.startsWith(kw + " ") || l.endsWith(" " + kw));
}

/**
 * Split locations into city-level and broad/national groups.
 * Returns { cityLocations, broadLocations }
 */
export function partitionLocations(locations: string[]): {
  cityLocations: string[];
  broadLocations: string[];
} {
  const cityLocations: string[] = [];
  const broadLocations: string[] = [];
  for (const loc of locations) {
    if (isBroadRegion(loc)) {
      broadLocations.push(loc);
    } else {
      cityLocations.push(loc);
    }
  }
  return { cityLocations, broadLocations };
}
