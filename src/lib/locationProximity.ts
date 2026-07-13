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

// Centralized rate-limiting queue for Nominatim to prevent 429 errors
let geocodeQueue: Promise<any> = Promise.resolve();

// Static local dictionary for core target locations in Florida and the UK
// Resolves lookups instantly, offline, and without network rate-limiting.
const LOCAL_GEO_DB: Record<string, { lat: number; lon: number }> = {
  "london": { lat: 51.5074, lon: -0.1278 },
  "london uk": { lat: 51.5074, lon: -0.1278 },
  "london area": { lat: 51.5074, lon: -0.1278 },
  "greater london": { lat: 51.5074, lon: -0.1278 },
  "greater london uk": { lat: 51.5074, lon: -0.1278 },
  "heathfield": { lat: 50.9696, lon: 0.2526 },
  "heathfield uk": { lat: 50.9696, lon: 0.2526 },
  "nottingham": { lat: 52.9548, lon: -1.1581 },
  "nottingham uk": { lat: 52.9548, lon: -1.1581 },
  "lincoln": { lat: 53.2294, lon: -0.5400 },
  "lincoln uk": { lat: 53.2294, lon: -0.5400 },
  "oxford": { lat: 51.7520, lon: -1.2577 },
  "oxford uk": { lat: 51.7520, lon: -1.2577 },
  "cambridge": { lat: 52.2053, lon: 0.1218 },
  "cambridge uk": { lat: 52.2053, lon: 0.1218 },
  "guildford": { lat: 51.2362, lon: -0.5704 },
  "guildford uk": { lat: 51.2362, lon: -0.5704 },
  "woodhall spa": { lat: 53.1534, lon: -0.2173 },
  "woodhall spa uk": { lat: 53.1534, lon: -0.2173 },
  "orlando": { lat: 28.5383, lon: -81.3792 },
  "orlando fl": { lat: 28.5383, lon: -81.3792 },
  "orlando florida": { lat: 28.5383, lon: -81.3792 },
  "orlando north east airport area": { lat: 28.5383, lon: -81.3792 },
  "edgewater": { lat: 28.9889, lon: -80.9023 },
  "edgewater fl": { lat: 28.9889, lon: -80.9023 },
  "edgewater florida": { lat: 28.9889, lon: -80.9023 },
  "sanford": { lat: 28.8008, lon: -81.2731 },
  "sanford fl": { lat: 28.8008, lon: -81.2731 },
  "sanford florida": { lat: 28.8008, lon: -81.2731 },
  "deltona": { lat: 28.9005, lon: -81.2637 },
  "deltona fl": { lat: 28.9005, lon: -81.2637 },
  "deltona florida": { lat: 28.9005, lon: -81.2637 },
  "deland": { lat: 29.0283, lon: -81.3031 },
  "deland fl": { lat: 29.0283, lon: -81.3031 },
  "deland florida": { lat: 29.0283, lon: -81.3031 },
  "daytona beach": { lat: 29.2108, lon: -81.0228 },
  "daytona beach fl": { lat: 29.2108, lon: -81.0228 },
  "daytona beach florida": { lat: 29.2108, lon: -81.0228 },
  "south daytona": { lat: 29.1658, lon: -81.0045 },
  "south daytona fl": { lat: 29.1658, lon: -81.0045 },
  "south daytona florida": { lat: 29.1658, lon: -81.0045 },
  "port orange": { lat: 29.1387, lon: -80.9968 },
  "port orange fl": { lat: 29.1387, lon: -80.9968 },
  "port orange florida": { lat: 29.1387, lon: -80.9968 },
  "new smyrna beach": { lat: 29.0258, lon: -80.9271 },
  "new smyrna beach fl": { lat: 29.0258, lon: -80.9271 },
  "new smyrna beach florida": { lat: 29.0258, lon: -80.9271 },
  "ln1": { lat: 53.235, lon: -0.54 },
  "ln1 uk": { lat: 53.235, lon: -0.54 },
  "ln5": { lat: 53.208, lon: -0.544 },
  "ln5 uk": { lat: 53.208, lon: -0.544 },
  "ng1": { lat: 52.955, lon: -1.147 },
  "ng1 uk": { lat: 52.955, lon: -1.147 },
  "ng7": { lat: 52.952, lon: -1.173 },
  "ng7 uk": { lat: 52.952, lon: -1.173 },
  "ec1a": { lat: 51.520, lon: -0.101 },
  "ec1a uk": { lat: 51.520, lon: -0.101 },
  "sw1a": { lat: 51.501, lon: -0.124 },
  "sw1a uk": { lat: 51.501, lon: -0.124 }
};

export function cleanLocationForGeocode(location: string): string {
  return location.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function isUKPostcodeOutcode(location: string): boolean {
  return /^[a-z]{1,2}[0-9][a-z0-9]?$/i.test(location.trim());
}

function normalizeLocationQuery(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
 * Geocode a location string using local cache, or OSM Nominatim (as a last resort fallback).
 * Results are cached in memory. Returns null on failure or timeout.
 */
export async function geocodeLocation(location: string): Promise<GeoCoords | null> {
  let cleanInput = location.trim();
  if (isUKPostcodeOutcode(cleanInput)) {
    if (!cleanInput.toLowerCase().endsWith(" uk")) {
      cleanInput = `${cleanInput} UK`;
    }
  }
  const cacheKey = cleanInput.toLowerCase();
  
  // Step 0: Check in-memory session cache first
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;

  // Step 1: Tier 1 - Local geocoding dictionary lookup
  const normalizedKey = normalizeLocationQuery(cleanInput);
  if (LOCAL_GEO_DB[normalizedKey]) {
    const coords = LOCAL_GEO_DB[normalizedKey];
    memCache.set(cacheKey, coords);
    return coords;
  }

  // Step 2: Tier 2 - OSM Nominatim (last resort fallback) run via queue
  const result = await (geocodeQueue = geocodeQueue.then(async () => {
    // Re-check cache in case it was resolved while in queue
    if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;
    
    // Add 1000ms delay to respect Nominatim's 1 req/sec rate limit policy
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanInput)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "JobSentinel/1.0 (job-sentinel-app)" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        memCache.set(cacheKey, null);
        return null;
      }
      const data = await res.json();
      if (!data || data.length === 0) {
        memCache.set(cacheKey, null);
        return null;
      }
      const coords: GeoCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      memCache.set(cacheKey, coords);
      return coords;
    } catch {
      memCache.set(cacheKey, null);
      return null;
    }
  }));

  return result;
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

  // Run sequentially to respect geocodeLocation's queue and memory cache
  for (const loc of locations) {
    if (!baseCoords) {
      unresolvable.push({ location: loc, distanceMiles: Infinity });
      continue;
    }
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
  }

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
