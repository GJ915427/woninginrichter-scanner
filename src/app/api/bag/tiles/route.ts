import { NextResponse } from 'next/server';
import { RDNAPTransformer } from '@/domain/geometry/rd-nap-trans';

interface TileData {
  tileKey: string;
  tileX: number;
  tileY: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY] in RD meters
  buildings: Array<{
    pandId: string;
    vboId?: string;
    footprint?: Array<[number, number]>;
    bouwjaar?: number;
    status?: string;
  }>;
  cachedAt: number;
}

// In-memory LRU cache capped at 50 tiles (approx 250m x 250m per tile)
const TILE_CACHE = new Map<string, TileData>();
const MAX_CACHED_TILES = 50;

function pruneCacheIfNeeded() {
  if (TILE_CACHE.size > MAX_CACHED_TILES) {
    const oldestKey = TILE_CACHE.keys().next().value;
    if (oldestKey) {
      TILE_CACHE.delete(oldestKey);
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  let tileX: number;
  let tileY: number;

  const rawTileX = searchParams.get('tileX');
  const rawTileY = searchParams.get('tileY');
  const rawX = searchParams.get('x');
  const rawY = searchParams.get('y');
  const rawLat = searchParams.get('lat');
  const rawLng = searchParams.get('lng') || searchParams.get('lon');

  if (rawTileX !== null && rawTileY !== null) {
    tileX = parseInt(rawTileX, 10);
    tileY = parseInt(rawTileY, 10);
  } else if (rawX !== null && rawY !== null) {
    const x = parseFloat(rawX);
    const y = parseFloat(rawY);
    tileX = Math.floor(x / 250);
    tileY = Math.floor(y / 250);
  } else if (rawLat !== null && rawLng !== null) {
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    const rd = RDNAPTransformer.wgs84ToRd(lat, lng);
    tileX = Math.floor(rd.x / 250);
    tileY = Math.floor(rd.y / 250);
  } else {
    // Default fallback to center of the Netherlands (Amersfoort / Onze Lieve Vrouwetoren)
    tileX = Math.floor(155000 / 250);
    tileY = Math.floor(463000 / 250);
  }

  const tileKey = `${tileX}_${tileY}`;
  const minX = tileX * 250;
  const minY = tileY * 250;
  const maxX = minX + 250;
  const maxY = minY + 250;
  const bbox: [number, number, number, number] = [minX, minY, maxX, maxY];

  // 1. Check in-memory LRU cache
  const cached = TILE_CACHE.get(tileKey);
  if (cached) {
    return NextResponse.json(
      {
        ...cached,
        fromCache: true,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  }

  // 2. Tile data payload (preloading ready for vector polygons & VBOs)
  const tilePayload: TileData = {
    tileKey,
    tileX,
    tileY,
    bbox,
    buildings: [],
    cachedAt: Date.now(),
  };

  pruneCacheIfNeeded();
  TILE_CACHE.set(tileKey, tilePayload);

  return NextResponse.json(
    {
      ...tilePayload,
      fromCache: false,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    }
  );
}
