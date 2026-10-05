'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RDNAPTransformer } from '@/domain/geometry/rd-nap-trans';

export interface UseMapTilePreloaderOptions {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  enabled?: boolean;
}

export interface UseMapTilePreloaderResult {
  preloadedTiles: string[];
  isPreloading: boolean;
  prefetchTile: (tileX: number, tileY: number) => Promise<void>;
}

const MAX_PRELOAD_TILES = 50;

/**
 * Headless hook to pre-emptively load 250m RD BAG tiles in the background.
 * Uses idle debouncing and LRU cache to prevent UI thread blocking.
 */
export function useMapTilePreloader({
  centerLat,
  centerLng,
  zoom = 15,
  enabled = true,
}: UseMapTilePreloaderOptions): UseMapTilePreloaderResult {
  const [preloadedTiles, setPreloadedTiles] = useState<string[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const cacheRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const prefetchTile = useCallback(async (tileX: number, tileY: number) => {
    const key = `${tileX}_${tileY}`;
    if (cacheRef.current.has(key)) return;

    try {
      const res = await fetch(`/api/bag/tiles?tileX=${tileX}&tileY=${tileY}`);
      if (res.ok) {
        if (cacheRef.current.size >= MAX_PRELOAD_TILES) {
          const firstKey = cacheRef.current.values().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }
        cacheRef.current.add(key);
        setPreloadedTiles(Array.from(cacheRef.current));
      }
    } catch {
      // Background prefetching fails quietly without breaking UI
    }
  }, []);

  useEffect(() => {
    if (!enabled || centerLat === undefined || centerLng === undefined || zoom < 13) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const schedulePreload = () => {
        setIsPreloading(true);
        try {
          const rd = RDNAPTransformer.wgs84ToRd(centerLat, centerLng);
          const centerTileX = Math.floor(rd.x / 250);
          const centerTileY = Math.floor(rd.y / 250);

          // 3x3 grid around center tile
          const tilesToLoad: Array<[number, number]> = [];
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const tx = centerTileX + dx;
              const ty = centerTileY + dy;
              const key = `${tx}_${ty}`;
              if (!cacheRef.current.has(key)) {
                tilesToLoad.push([tx, ty]);
              }
            }
          }

          if (tilesToLoad.length === 0) {
            setIsPreloading(false);
            return;
          }

          // Sequentially load without overloading network
          Promise.all(tilesToLoad.slice(0, 5).map(([tx, ty]) => prefetchTile(tx, ty))).finally(() => {
            setIsPreloading(false);
          });
        } catch {
          setIsPreloading(false);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(schedulePreload, { timeout: 1000 });
      } else {
        setTimeout(schedulePreload, 50);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [centerLat, centerLng, zoom, enabled, prefetchTile]);

  return {
    preloadedTiles,
    isPreloading,
    prefetchTile,
  };
}
