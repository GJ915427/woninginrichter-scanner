import { AHNElevationResult, CityJSON3DModel } from '../types';
import { BuildingHeightAttributes } from '../../domain/architectural/types';

export interface AhnClientOptions {
  wmsBaseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class AhnElevationClient {
  private wmsBaseUrl: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(options: AhnClientOptions = {}) {
    this.wmsBaseUrl =
      options.wmsBaseUrl ||
      'https://service.pdok.nl/rws/ahn/wms/v1_0';
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs || 2000;
  }

  /**
   * Resolves ground datum directly from 3D BAG AHN-derived LiDAR attributes.
   */
  static getGroundDatumFrom3DBAG(model: CityJSON3DModel): AHNElevationResult {
    const attrs = model.attributes || {};
    const maaiveld = model.groundHeightNAP;

    let source: 'AHN5' | 'AHN4' | 'AHN3' | '3D_BAG' = '3D_BAG';
    if (attrs.b3_mutatie_ahn4_ahn5) {
      source = 'AHN5';
    } else if (attrs.puntenwolk_bron?.toUpperCase().includes('AHN5')) {
      source = 'AHN5';
    } else if (attrs.puntenwolk_bron?.toUpperCase().includes('AHN4')) {
      source = 'AHN4';
    }

    return {
      groundLevelNAP: maaiveld,
      source,
      uncertaintyMeters: attrs.b3_rmse ? Math.round(attrs.b3_rmse * 100) / 100 : 0.05,
    };
  }

  /**
   * Extracts clean BuildingHeightAttributes for FloorBuilder.
   */
  static getBuildingHeights(model: CityJSON3DModel): BuildingHeightAttributes {
    return {
      groundLevelNAP: model.groundHeightNAP,
      eavesHeightNAP: model.gutterHeightNAP,
      ridgeHeightNAP: model.roofHeightNAP,
      roofType: model.roofType,
    };
  }

  /**
   * Queries AHN point elevation for coordinates (RD EPSG:28992) via PDOK WMS GetFeatureInfo.
   * Includes defensive timeout protection and fallback.
   */
  async getGroundElevationPoint(
    xRD: number,
    yRD: number
  ): Promise<AHNElevationResult> {
    const buffer = 1.0;
    const bbox = `${xRD - buffer},${yRD - buffer},${xRD + buffer},${yRD + buffer}`;

    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'ahn_maaiveld',
      QUERY_LAYERS: 'ahn_maaiveld',
      BBOX: bbox,
      CRS: 'EPSG:28992',
      WIDTH: '10',
      HEIGHT: '10',
      I: '5',
      J: '5',
      INFO_FORMAT: 'application/json',
    });

    try {
      const url = `${this.wmsBaseUrl}?${params.toString()}`;
      const signal =
        typeof AbortSignal?.timeout === 'function'
          ? AbortSignal.timeout(this.timeoutMs)
          : undefined;

      const res = await this.fetchFn(url, { signal });
      if (!res.ok) {
        return { groundLevelNAP: 0.0, source: 'FALLBACK' };
      }

      const json = await res.json();
      const val =
        json?.features?.[0]?.properties?.GRAY_INDEX ??
        json?.features?.[0]?.properties?.value;

      if (typeof val === 'number' && !isNaN(val)) {
        return {
          groundLevelNAP: Math.round(val * 100) / 100,
          source: 'AHN5',
          uncertaintyMeters: 0.05,
        };
      }
    } catch {
      // Timeout or network error falls back safely
    }

    return {
      groundLevelNAP: 0.0,
      source: 'FALLBACK',
    };
  }
}
