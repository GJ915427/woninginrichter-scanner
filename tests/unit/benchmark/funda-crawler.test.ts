import { describe, it, expect } from 'vitest';
import {
  FundaFloorplannerCrawler,
  assertExactBagAddressMatch,
  parseHouseNumber,
  normalizeCityName,
} from '../../../scripts/funda-floorplanner-crawler';
import { FloorplannerIngestRunner } from '../../../scripts/ingest-floorplanner-benchmark';
import fixtures from '../../fixtures/sample-funda-listings.json';

describe('FundaFloorplannerCrawler Unit Tests (VM-REF-01 t/m 03)', () => {
  const crawler = new FundaFloorplannerCrawler({ rateLimitMs: 0 });

  it('should parse Singel 13 Bussum HTML and extract exact address, typology, and floorplanner ID', () => {
    const result = crawler.parseListingHtml(
      fixtures.singel_13_bussum_html,
      'https://www.funda.nl/detail/koop/bussum/huis-singel-13/42345678/'
    );

    expect(result).not.toBeNull();
    expect(result?.address.street).toBe('Singel');
    expect(result?.address.houseNumber).toBe('13');
    expect(result?.address.postalCode).toBe('1402 NT');
    expect(result?.address.city).toBe('Bussum');
    expect(result?.typology).toBe('tussenwoning');
    expect(result?.floorplannerProjectId).toBe(21000075);
    expect(result?.livingAreaM2).toBe(115);
    expect(result?.constructionYear).toBe(1906);
  });

  it('should parse Google Cache snapshot HTML identically to live Funda page (Stage 1 anti-bot)', () => {
    const result = crawler.parseListingHtml(
      fixtures.singel_13_google_cache_html,
      'https://webcache.googleusercontent.com/search?q=cache:https://www.funda.nl/detail/koop/bussum/huis-singel-13/'
    );

    expect(result).not.toBeNull();
    expect(result?.address.street).toBe('Singel');
    expect(result?.address.houseNumber).toBe('13');
    expect(result?.address.postalCode).toBe('1402 NT');
    expect(result?.address.city).toBe('Bussum');
    expect(result?.typology).toBe('tussenwoning');
    expect(result?.floorplannerProjectId).toBe(21000075);
  });

  it('should parse Kerkstraat 24 Deventer and map hoekwoning typology with project URL link', () => {
    const result = crawler.parseListingHtml(
      fixtures.kerkstraat_24_deventer_html,
      'https://www.funda.nl/detail/koop/deventer/huis-kerkstraat-24/'
    );

    expect(result).not.toBeNull();
    expect(result?.address.street).toBe('Kerkstraat');
    expect(result?.address.houseNumber).toBe('24');
    expect(result?.address.postalCode).toBe('7411 KL');
    expect(result?.address.city).toBe('Deventer');
    expect(result?.typology).toBe('hoekwoning');
    expect(result?.floorplannerProjectId).toBe(21000088);
    expect(result?.livingAreaM2).toBe(128);
    expect(result?.constructionYear).toBe(1932);
  });

  it('should return null when no floorplanner embed is present in the listing HTML', () => {
    const result = crawler.parseListingHtml(
      fixtures.missing_floorplanner_html,
      'https://www.funda.nl/detail/koop/test/huis-1/'
    );

    expect(result).toBeNull();
  });

  it('should strictly enforce NEN 2580 / BBMI surface tolerance (INV-REF-02: <= 5.0%)', () => {
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(117, 115)).toBe(true);
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(120, 115)).toBe(true);
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(122, 115)).toBe(false);
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(105, 115)).toBe(false);
  });

  it('should correctly map all 6 Dutch housing typologies from Funda / NVM labels', () => {
    expect(FundaFloorplannerCrawler.mapFundaTypology('Eengezinswoning, tussenwoning')).toBe(
      'tussenwoning'
    );
    expect(FundaFloorplannerCrawler.mapFundaTypology('Eengezinswoning, hoekwoning')).toBe(
      'hoekwoning'
    );
    expect(FundaFloorplannerCrawler.mapFundaTypology('2-onder-1-kapwoning')).toBe(
      'twee_onder_een_kap'
    );
    expect(FundaFloorplannerCrawler.mapFundaTypology('Vrijstaande woning')).toBe('vrijstaand');
    expect(FundaFloorplannerCrawler.mapFundaTypology('Bovenwoning (appartement)')).toBe(
      'appartement'
    );
    expect(
      FundaFloorplannerCrawler.mapFundaTypology('Woning met samengesteld dak en schuine wanden')
    ).toBe('samengesteld');
  });

  it('VM-HRV-01: assertExactBagAddressMatch strictly rejects cross-municipality or mismatched house numbers (fail-closed)', () => {
    expect(() => {
      assertExactBagAddressMatch(null, {
        street: 'Dorpsstraat',
        houseNumber: '1',
        city: 'Amstelveen',
      });
    }).toThrow(/REJECTED_NO_EXACT_BAG_VBO/);

    const guttecovenDoc = {
      huisnummer: 1,
      straatnaam: 'Dorpsstraat',
      woonplaatsnaam: 'Guttecoven',
      weergavenaam: 'Dorpsstraat 1A-1, Guttecoven',
    };
    expect(() => {
      assertExactBagAddressMatch(guttecovenDoc, {
        street: 'Dorpsstraat',
        houseNumber: '1',
        city: 'Amstelveen',
      });
    }).toThrow(/REJECTED_NO_EXACT_BAG_VBO/);

    const amstelveenDoc98 = {
      huisnummer: 98,
      straatnaam: 'Dorpsstraat',
      woonplaatsnaam: 'Amstelveen',
      weergavenaam: 'Dorpsstraat 98, Amstelveen',
    };
    expect(() => {
      assertExactBagAddressMatch(amstelveenDoc98, {
        street: 'Dorpsstraat',
        houseNumber: '1',
        city: 'Amstelveen',
      });
    }).toThrow(/REJECTED_NO_EXACT_BAG_VBO/);

    const validDoc = {
      huisnummer: 13,
      straatnaam: 'Singel',
      woonplaatsnaam: 'Bussum',
      weergavenaam: 'Singel 13, 1402NT Bussum',
    };
    expect(() => {
      assertExactBagAddressMatch(validDoc, {
        street: 'Singel',
        houseNumber: '13',
        city: 'Bussum',
      });
    }).not.toThrow();
  });

  it('VM-HRV-02: validateSurfaceToleranceWithWallOffset performs 25cm wall offset and multi-storey sum', () => {
    const floor0Polygon: Array<[number, number]> = [
      [0, 0],
      [3.75, 0],
      [3.75, 9.91],
      [0, 9.91],
      [0, 0],
    ];
    const floor1Polygon: Array<[number, number]> = [
      [0, 0],
      [3.75, 0],
      [3.75, 9.91],
      [0, 9.91],
      [0, 0],
    ];

    const floors = [{ outerPolygonM: floor0Polygon }, { outerPolygonM: floor1Polygon }];

    const result = FundaFloorplannerCrawler.validateSurfaceToleranceWithWallOffset(
      floors,
      61,
      0.25,
      5.0
    );

    expect(result.isValid).toBe(true);
    expect(result.diffPct).toBeLessThanOrEqual(5.0);
    expect(result.calculatedGoM2).toBeGreaterThanOrEqual(60.0);
    expect(result.calculatedGoM2).toBeLessThanOrEqual(63.0);
  });

  it('VM-HRV-03: resolveBagPandIdViaOgcApi handles array pand.href and regex extraction of 16-digit ID', async () => {
    const runner = new FloorplannerIngestRunner();

    const mockJson = JSON.stringify({
      features: [
        {
          properties: {
            oppervlakte: 118,
            'pand.href': [
              'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items/0381100000114840',
            ],
          },
        },
      ],
    });

    // @ts-expect-error accessing private method for test verification
    runner.httpGet = async () => mockJson;

    const pandId = await runner.resolveBagPandIdViaOgcApi('0381010000030960');
    expect(pandId).toBe('0381100000114840');
    expect(pandId).toMatch(/^\d{16}$/);
    expect(pandId.endsWith('0000000000')).toBe(false);
  });

  it('VM-HRV-04: parseHouseNumber & normalizeCityName handle letters, additions, and colloquial city names', () => {
    expect(parseHouseNumber('13')).toEqual({ number: 13 });
    expect(parseHouseNumber('153B')).toEqual({ number: 153, letter: 'B' });
    expect(parseHouseNumber('10-2')).toEqual({ number: 10, addition: '2' });
    expect(parseHouseNumber('199A-1')).toEqual({ number: 199, letter: 'A', addition: '1' });

    expect(normalizeCityName('Den Haag')).toBe("'s-Gravenhage");
    expect(normalizeCityName('Den Bosch')).toBe("'s-Hertogenbosch");
    expect(normalizeCityName('Zwolle')).toBe('Zwolle');

    const denHaagDoc = {
      huisnummer: 153,
      huisletter: 'B',
      straatnaam: 'Rijksweg',
      woonplaatsnaam: "'s-Gravenhage",
    };
    expect(() =>
      assertExactBagAddressMatch(denHaagDoc, {
        street: 'Rijksweg',
        houseNumber: '153B',
        city: 'Den Haag',
      })
    ).not.toThrow();
  });

  it('VM-HRV-05: parseHomeShowSitePayload extracts genuine Dutch address, Floorplanner ID, and typology', () => {
    const sampleData = {
      street: 'M H Tromplaan',
      number: '29',
      addition: '',
      zipcode: '2121 XD',
      city: 'Bennebroek',
      pages: [
        {
          type: 'InteractiveFloorPlan',
          url: 'https://floorplanner.com/projects/190191589/viewer',
        },
      ],
    };
    const sampleDetails = '<dt>Soort woonhuis</dt><dd>Eengezinswoning, 2-onder-1-kapwoning</dd>';

    const parsed = FundaFloorplannerCrawler.parseHomeShowSitePayload(
      sampleData,
      sampleDetails,
      182849
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.floorplannerProjectId).toBe(190191589);
    expect(parsed?.address.street).toBe('M H Tromplaan');
    expect(parsed?.address.houseNumber).toBe('29');
    expect(parsed?.address.postalCode).toBe('2121XD');
    expect(parsed?.address.city).toBe('Bennebroek');
    expect(parsed?.typology).toBe('twee_onder_een_kap');
  });
});
