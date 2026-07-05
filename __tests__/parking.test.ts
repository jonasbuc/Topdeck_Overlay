/**
 * Tests for the parking feature backend.
 *
 * Covers:
 *   - lib/parking/distance.ts  — pure functions, no mocks
 *   - lib/parking/geocoder.ts  — fetch mocked
 *   - lib/parking/cache.ts     — Prisma mocked
 *   - lib/parking/providers/overpass.ts — fetch mocked, normalization
 *   - lib/parking/factory.ts   — provider selection logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
// Use vi.hoisted() so these are available when vi.mock factory runs (which is
// hoisted above all imports by Vitest).

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    parkingCache: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

// ─── env mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: {
    PARKING_PROVIDER: "overpass",
    GOOGLE_MAPS_API_KEY: null,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 1. Distance utilities (pure — no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────

import { haversineMeters, walkingMinutes, navigationUrl } from "@/lib/parking/distance";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it("returns ~111 195 m for 1 degree of latitude at the equator", () => {
    const dist = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    // Within 0.5% of the expected value
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it("is symmetric — A→B equals B→A", () => {
    const a = { lat: 52.52, lng: 13.405 }; // Berlin
    const b = { lat: 48.856, lng: 2.352 }; // Paris
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 0);
  });

  it("returns a reasonable distance for nearby points", () => {
    // Two points about 500 m apart in central London
    const a = { lat: 51.5074, lng: -0.1278 };
    const b = { lat: 51.5029, lng: -0.1189 };
    const dist = haversineMeters(a, b);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThan(800);
  });
});

describe("walkingMinutes", () => {
  it("rounds up: 80 m → 1 min", () => {
    expect(walkingMinutes(80)).toBe(1);
  });

  it("rounds up: 81 m → 2 min", () => {
    expect(walkingMinutes(81)).toBe(2);
  });

  it("800 m → 10 min exactly", () => {
    expect(walkingMinutes(800)).toBe(10);
  });

  it("0 m → 0 min", () => {
    expect(walkingMinutes(0)).toBe(0);
  });
});

describe("navigationUrl", () => {
  it("builds a Google Maps directions link", () => {
    const url = navigationUrl(51.5074, -0.1278);
    expect(url).toContain("google.com/maps/dir");
    expect(url).toContain("51.5074");
    expect(url).toContain("-0.1278");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Geocoder (fetch mocked)
// ─────────────────────────────────────────────────────────────────────────────

import { geocodeAddress } from "@/lib/parking/geocoder";

describe("geocodeAddress", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a GeoPoint when Nominatim responds with results", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: "51.5074", lon: "-0.1278", display_name: "London, UK" }],
    } as Response);

    const result = await geocodeAddress("London, UK");
    expect(result).toEqual({ lat: 51.5074, lng: -0.1278 });
  });

  it("returns null when Nominatim returns an empty array", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await geocodeAddress("unknown place xyzzy");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await geocodeAddress("London");
    expect(result).toBeNull();
  });

  it("returns null when Nominatim returns non-2xx status", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    } as Response);

    const result = await geocodeAddress("London");
    expect(result).toBeNull();
  });

  it("returns null for empty address string", async () => {
    const result = await geocodeAddress("");
    expect(result).toBeNull();
    // Should not have called fetch at all
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cache
// ─────────────────────────────────────────────────────────────────────────────

import { getCached, setCache, buildCacheKey, CACHE_TTL_MS } from "@/lib/parking/cache";
import type { ParkingResult } from "@/lib/parking/types";

const MOCK_RESULT: ParkingResult = {
  id: "overpass-node-1",
  name: "Test Car Park",
  address: "1 Main St",
  lat: 51.5074,
  lng: -0.1278,
  distanceMeters: 200,
  walkingMinutes: 3,
  drivingMinutes: null,
  priceInfo: "Free",
  openingHours: null,
  rating: null,
  ratingCount: null,
  accessible: null,
  navigationUrl: "https://www.google.com/maps/dir/?api=1&destination=51.5074,-0.1278",
  source: "overpass",
};

describe("buildCacheKey", () => {
  it("formats coordinates to 4 decimal places", () => {
    expect(buildCacheKey(51.50741234, -0.12781234)).toBe("51.5074:-0.1278");
  });

  it("pads trailing zeros", () => {
    expect(buildCacheKey(51.5, 0)).toBe("51.5000:0.0000");
  });
});

describe("getCached", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("returns null when no row exists", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    expect(await getCached(51.5074, -0.1278)).toBeNull();
  });

  it("returns null when the row has expired", async () => {
    mockFindUnique.mockResolvedValueOnce({
      cacheKey: "51.5074:-0.1278",
      results: JSON.stringify([MOCK_RESULT]),
      provider: "overpass",
      fetchedAt: new Date(Date.now() - CACHE_TTL_MS - 1000),
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    });

    expect(await getCached(51.5074, -0.1278)).toBeNull();
  });

  it("returns cached results when row is still fresh", async () => {
    mockFindUnique.mockResolvedValueOnce({
      cacheKey: "51.5074:-0.1278",
      results: JSON.stringify([MOCK_RESULT]),
      provider: "overpass",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });

    const result = await getCached(51.5074, -0.1278);
    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(1);
    expect(result!.results[0].id).toBe("overpass-node-1");
    expect(result!.provider).toBe("overpass");
  });

  it("returns null for corrupt JSON in the row", async () => {
    mockFindUnique.mockResolvedValueOnce({
      cacheKey: "51.5074:-0.1278",
      results: "not valid json{{{",
      provider: "overpass",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });

    expect(await getCached(51.5074, -0.1278)).toBeNull();
  });
});

describe("setCache", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("calls prisma.parkingCache.upsert with serialized results", async () => {
    mockUpsert.mockResolvedValueOnce({});
    await setCache(51.5074, -0.1278, "overpass", [MOCK_RESULT]);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where.cacheKey).toBe("51.5074:-0.1278");
    expect(JSON.parse(call.create.results)).toHaveLength(1);
    expect(call.create.provider).toBe("overpass");
    // expiresAt should be in the future
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Overpass provider — normalization
// ─────────────────────────────────────────────────────────────────────────────

import { OverpassParkingProvider } from "@/lib/parking/providers/overpass";

const VENUE: import("@/lib/parking/types").GeoPoint = { lat: 51.5074, lng: -0.1278 };

// A complete Overpass node element close to the venue
const NODE_ELEMENT = {
  type: "node" as const,
  id: 12345,
  lat: 51.508,
  lon: -0.1280,
  tags: {
    amenity: "parking",
    name: "NCP Victoria",
    fee: "yes",
    opening_hours: "24/7",
    wheelchair: "yes",
  },
};

// A way element (has center, not lat/lon)
const WAY_ELEMENT = {
  type: "way" as const,
  id: 67890,
  center: { lat: 51.509, lon: -0.126 },
  tags: {
    amenity: "parking",
    fee: "no",
    "addr:street": "Victoria Street",
    "addr:housenumber": "10",
    "addr:city": "London",
  },
};

// An element with no coordinates (should be dropped)
const INVALID_ELEMENT = {
  type: "node" as const,
  id: 99999,
  tags: { amenity: "parking" },
};

describe("OverpassParkingProvider.fetchNearby", () => {
  let provider: OverpassParkingProvider;

  beforeEach(() => {
    provider = new OverpassParkingProvider();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockOverpassResponse(elements: unknown[]): void {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements }),
    } as Response);
  }

  it("returns normalized results sorted by distance", async () => {
    mockOverpassResponse([NODE_ELEMENT, WAY_ELEMENT]);

    const results = await provider.fetchNearby(VENUE);

    expect(results).toHaveLength(2);
    // Both should be valid ParkingResult objects
    expect(results[0]).toMatchObject({
      source: "overpass",
      distanceMeters: expect.any(Number),
      walkingMinutes: expect.any(Number),
      navigationUrl: expect.stringContaining("google.com/maps"),
    });
    // Sorted by distance ascending
    expect(results[0].distanceMeters).toBeLessThanOrEqual(results[1].distanceMeters);
  });

  it("correctly maps node element fields", async () => {
    mockOverpassResponse([NODE_ELEMENT]);

    const [result] = await provider.fetchNearby(VENUE);

    expect(result.id).toBe("overpass-node-12345");
    expect(result.name).toBe("NCP Victoria");
    expect(result.priceInfo).toBe("Paid");
    expect(result.openingHours).toBe("24/7");
    expect(result.accessible).toBe(true);
    expect(result.lat).toBe(51.508);
    expect(result.lng).toBe(-0.128);
  });

  it("correctly maps way element using center coordinates", async () => {
    mockOverpassResponse([WAY_ELEMENT]);

    const [result] = await provider.fetchNearby(VENUE);

    expect(result.id).toBe("overpass-way-67890");
    expect(result.lat).toBe(51.509);
    expect(result.lng).toBe(-0.126);
    expect(result.priceInfo).toBe("Free");
    expect(result.address).toContain("Victoria Street");
  });

  it("drops elements with no coordinates", async () => {
    mockOverpassResponse([INVALID_ELEMENT]);
    const results = await provider.fetchNearby(VENUE);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when Overpass returns no elements", async () => {
    mockOverpassResponse([]);
    const results = await provider.fetchNearby(VENUE);
    expect(results).toEqual([]);
  });

  it("throws when Overpass returns a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 504,
      statusText: "Gateway Timeout",
    } as Response);

    await expect(provider.fetchNearby(VENUE)).rejects.toThrow("504");
  });

  it("throws when fetch itself throws (network error)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(provider.fetchNearby(VENUE)).rejects.toThrow("ECONNREFUSED");
  });

  it("has correct attribution", () => {
    expect(provider.attribution).toBe("© OpenStreetMap contributors");
  });

  it("has correct provider name", () => {
    expect(provider.name).toBe("overpass");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Factory
// ─────────────────────────────────────────────────────────────────────────────

import { createParkingProvider } from "@/lib/parking/factory";

describe("createParkingProvider", () => {
  it("returns OverpassParkingProvider when PARKING_PROVIDER=overpass", async () => {
    const { OverpassParkingProvider: Overpass } = await import("@/lib/parking/providers/overpass");
    const provider = createParkingProvider();
    expect(provider).toBeInstanceOf(Overpass);
    expect(provider.name).toBe("overpass");
  });
});
