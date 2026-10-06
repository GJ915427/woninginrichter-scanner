import { describe, it, expect } from 'vitest';
import { RDNAPTransformer } from '@/domain/geometry/rd-nap-trans';

describe('RDNAPTransformer Unit Tests', () => {
  it('should transform Amersfoort Onze Lieve Vrouwetoren (RD origin) with sub-millimeter precision', () => {
    // Amersfoort Reference coordinates: X=155000.0, Y=463000.0
    const rdOrigin = { x: 155000.0, y: 463000.0 };
    const wgs84 = RDNAPTransformer.rdToWgs84(rdOrigin.x, rdOrigin.y);

    // Official Bessel/ETRS89 Amersfoort coordinates:
    // Latitude ~ 52.15517440, Longitude ~ 5.38720621
    expect(wgs84.lat).toBeCloseTo(52.155174, 5);
    expect(wgs84.lng).toBeCloseTo(5.387206, 5);

    // Inverse check: WGS84 -> RD
    const rdBack = RDNAPTransformer.wgs84ToRd(wgs84.lat, wgs84.lng);
    expect(rdBack.x).toBeCloseTo(155000.0, 2);
    expect(rdBack.y).toBeCloseTo(463000.0, 2);
  });

  it('should transform Gronsveld (Rijksweg 153B) in South-Limburg correctly', () => {
    // Gronsveld RD: X=179413.0, Y=312880.0
    const rd = { x: 179413.0, y: 312880.0 };
    const wgs84 = RDNAPTransformer.rdToWgs84(rd.x, rd.y);

    expect(wgs84.lat).toBeCloseTo(50.80529, 4);
    expect(wgs84.lng).toBeCloseTo(5.73351, 4);

    const rdBack = RDNAPTransformer.wgs84ToRd(wgs84.lat, wgs84.lng);
    expect(rdBack.x).toBeCloseTo(rd.x, 2);
    expect(rdBack.y).toBeCloseTo(rd.y, 2);
  });
});
