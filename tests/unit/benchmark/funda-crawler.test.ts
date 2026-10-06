import { describe, it, expect } from 'vitest';
import { FundaFloorplannerCrawler } from '../../../scripts/funda-floorplanner-crawler';
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
    // 115m² nominal:
    // +2.0m² (117m²) -> 1.74% diff -> ACCEPT
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(117, 115)).toBe(true);

    // +5.0m² (120m²) -> 4.35% diff -> ACCEPT (within 5.0% threshold)
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(120, 115)).toBe(true);

    // +7.0m² (122m²) -> 6.09% diff -> REJECT (exceeds 5.0% threshold)
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(122, 115)).toBe(false);

    // -10m² (105m²) -> 8.70% diff -> REJECT
    expect(FundaFloorplannerCrawler.validateSurfaceTolerance(105, 115)).toBe(false);
  });

  it('should correctly map all 6 Dutch housing typologies from Funda labels', () => {
    expect(FundaFloorplannerCrawler.mapFundaTypology('Eengezinswoning, tussenwoning')).toBe('tussenwoning');
    expect(FundaFloorplannerCrawler.mapFundaTypology('Eengezinswoning, hoekwoning')).toBe('hoekwoning');
    expect(FundaFloorplannerCrawler.mapFundaTypology('2-onder-1-kapwoning')).toBe('twee_onder_een_kap');
    expect(FundaFloorplannerCrawler.mapFundaTypology('Vrijstaande woning')).toBe('vrijstaand');
    expect(FundaFloorplannerCrawler.mapFundaTypology('Bovenwoning (appartement)')).toBe('appartement');
    expect(FundaFloorplannerCrawler.mapFundaTypology('Woning met samengesteld dak en schuine wanden')).toBe('samengesteld_schuin');
  });
});
