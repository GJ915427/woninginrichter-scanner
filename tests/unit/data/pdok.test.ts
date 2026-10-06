import { describe, it, expect } from 'vitest';
import { PdokLocatieserverClient } from '@/data/pdok/pdok-locatieserver-client';

describe('PdokLocatieserverClient Unit Tests', () => {
  it('should parse POINT and BOX WKT strings into coordinates', () => {
    const pt = PdokLocatieserverClient.parsePointWKT('POINT(121657.123 487392.456)');
    expect(pt[0]).toBeCloseTo(121657.123, 3);
    expect(pt[1]).toBeCloseTo(487392.456, 3);

    const box = PdokLocatieserverClient.parseBoxWKT(
      'BOX(121600.0 487300.0 121700.0 487500.0)'
    );
    expect(box[0]).toBe(121600.0);
    expect(box[1]).toBe(487300.0);
    expect(box[2]).toBe(121700.0);
    expect(box[3]).toBe(487500.0);

    // Empty/invalid fallbacks
    expect(PdokLocatieserverClient.parsePointWKT('')).toEqual([0, 0]);
    expect(PdokLocatieserverClient.parseBoxWKT(undefined)).toEqual([0, 0, 0, 0]);
  });

  it('should map lookup doc to PDOKLocationResult adhering to contract', () => {
    const doc = {
      id: 'adr-12345',
      type: 'adres',
      weergavenaam: 'Rijksweg 153B, 6267AE Cadier en Keer',
      centroide_rd: 'POINT(180500.25 315400.75)',
      boundingbox_rd: 'BOX(180450 315350 180550 315450)',
      pandidentificatie: '0905100000018803',
      huisnummer: 153,
      huisletter: 'B',
      postcode: '6267AE',
      woonplaatsnaam: 'Cadier en Keer',
      score: 12.34,
    };

    const result = PdokLocatieserverClient.mapDocToLocationResult(doc);

    expect(result.bagId).toBe('0905100000018803');
    expect(result.address).toBe('Rijksweg 153B, 6267AE Cadier en Keer');
    expect(result.rdCoordinates[0]).toBeCloseTo(180500.25, 2);
    expect(result.rdCoordinates[1]).toBeCloseTo(315400.75, 2);
    expect(result.boundingBox).toEqual([180450, 315350, 180550, 315450]);
  });

  it('should perform suggest, lookup, search, and reverse via client', async () => {
    const mockResponses: Record<string, any> = {
      suggest: {
        response: {
          docs: [
            {
              id: 'adr-1',
              type: 'adres',
              weergavenaam: 'Dorpsstraat 1, Ons Dorp',
              score: 9.8,
            },
          ],
        },
      },
      lookup: {
        response: {
          docs: [
            {
              id: 'adr-1',
              type: 'adres',
              weergavenaam: 'Dorpsstraat 1, Ons Dorp',
              centroide_rd: 'POINT(150000 450000)',
              boundingbox_rd: 'BOX(149900 449900 150100 450100)',
              pandidentificatie: '0363100012345678',
            },
          ],
        },
      },
    };

    const mockFetch = async (url: string) => {
      if (url.includes('suggest')) {
        return new Response(JSON.stringify(mockResponses.suggest), { status: 200 });
      }
      if (url.includes('lookup') || url.includes('free') || url.includes('reverse')) {
        return new Response(JSON.stringify(mockResponses.lookup), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    const client = new PdokLocatieserverClient({ fetchFn: mockFetch as any });

    const suggestions = await client.suggest('Dorpsstraat');
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].weergavenaam).toBe('Dorpsstraat 1, Ons Dorp');

    const lookupResult = await client.lookup('adr-1');
    expect(lookupResult).not.toBeNull();
    expect(lookupResult!.bagId).toBe('0363100012345678');
    expect(lookupResult!.rdCoordinates).toEqual([150000, 450000]);

    const searchResults = await client.search('Dorpsstraat');
    expect(searchResults.length).toBe(1);

    const reverseResult = await client.reverse(52.1, 5.1);
    expect(reverseResult).not.toBeNull();
  });
});
