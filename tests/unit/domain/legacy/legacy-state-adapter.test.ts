import { describe, it, expect } from 'vitest';
import { adaptBuildingPayloadToLegacyState } from '@/domain/legacy/legacy-state-adapter';

describe('Legacy State Adapter (Contract Bridge between /api/building and Legacy UI)', () => {
  it('should correctly map raw API payload to legacy state with zero undefined dashes', () => {
    const mockApiPayload = {
      pandId: '0905100000018803',
      bag: {
        identificatie: '0905100000018803',
        bouwjaar: 1969,
        status: 'Pand in gebruik',
        oppervlakte: 130,
        geometrieRD: {},
      },
      cityJson: {
        attributes: {
          b3_volume_lod22: 744,
          b3_dak_type: 'samengesteld',
        },
        roofHeightNAP: 73.25,
        groundHeightNAP: 63.99,
        gutterHeightNAP: 69.79,
      },
      vbos: [
        {
          identificatie: '0905010000002118',
          oppervlakte: 173,
          gebruiksdoel: 'woonfunctie',
        },
      ],
      bgt: {
        installaties: [],
        bomen: [],
      },
      neighbors: [],
      epOnline: null,
      retrievedAt: '2026-10-03T00:00:00.000Z',
    };

    const state = adaptBuildingPayloadToLegacyState(mockApiPayload, 'Rijksweg 153B, 6247AD Gronsveld');

    expect(state.bouwjaar).toBe(1969);
    expect(state.oppervlakte).toBe(173);
    expect(state.pandOppervlakte).toBe(130);
    expect(state.gebruiksdoel).toBe('Woonfunctie');
    expect(state.volumeM3).toBe(744);
    expect(state.nokhoogte).toBeCloseTo(9.26, 1);
    expect(state.bouwlagen).toBe(3);
    expect(state.address).toBe('Rijksweg 153B, 6247AD Gronsveld');
  });
});
