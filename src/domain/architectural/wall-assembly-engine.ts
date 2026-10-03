/**
 * WallAssemblyEngine
 * Berekent de exacte bouwkundige wandopbouw en geveldiktes volgens Nederlandse normen
 * en Bouwbesluit-tijdvakken, inclusief correcte inspringing op erfgrenzen bij mandelige muren.
 */

export interface WallSpecification {
  bouwperiode: string;
  outerLeafM: number; // Buitenblad metselwerk
  cavityM: number; // Luchtspouw + Isolatie
  innerLeafM: number; // Dragend binnenblad (kalkzandsteen/beton)
  totalFacadeThicknessM: number; // Totale buitenmuurdikte
  partyWallThicknessM: number; // Woningscheidende muurdikte
  isAcousticDualLeaf: boolean; // True na 1980 (ankerloze spouw)
  rcValue: number; // Thermische weerstand (m²K/W)
}

export class WallAssemblyEngine {
  /**
   * Bepaalt de bouwkundige wandopbouw op basis van het BAG bouwjaar
   */
  static getSpecification(bouwjaar: number): WallSpecification {
    if (bouwjaar < 1920) {
      return {
        bouwperiode: 'Vóór 1920 (Massief Steens)',
        outerLeafM: 0.22,
        cavityM: 0.0,
        innerLeafM: 0.02, // stucwerk op riet
        totalFacadeThicknessM: 0.24,
        partyWallThicknessM: 0.22,
        isAcousticDualLeaf: false,
        rcValue: 0.35,
      };
    }
    if (bouwjaar < 1975) {
      return {
        bouwperiode: '1920-1974 (Traditionele Ongeïsoleerde Spouw)',
        outerLeafM: 0.1,
        cavityM: 0.08,
        innerLeafM: 0.1,
        totalFacadeThicknessM: 0.28,
        partyWallThicknessM: 0.22,
        isAcousticDualLeaf: false,
        rcValue: 0.4,
      };
    }
    if (bouwjaar < 1992) {
      return {
        bouwperiode: '1975-1991 (NEN 1068 Eerste Isolatie & Ankerloos)',
        outerLeafM: 0.1,
        cavityM: 0.09, // 5cm isolatie + 4cm lucht
        innerLeafM: 0.12,
        totalFacadeThicknessM: 0.31,
        partyWallThicknessM: 0.28, // vroege ankerloze spouw (10+8+10)
        isAcousticDualLeaf: true,
        rcValue: 1.3,
      };
    }
    if (bouwjaar < 2003) {
      return {
        bouwperiode: '1992-2002 (Bouwbesluit 1992)',
        outerLeafM: 0.1,
        cavityM: 0.11, // 8cm isolatie + 3cm spouw
        innerLeafM: 0.12,
        totalFacadeThicknessM: 0.33,
        partyWallThicknessM: 0.29, // 12 + 5 (spouw) + 12
        isAcousticDualLeaf: true,
        rcValue: 2.5,
      };
    }
    if (bouwjaar < 2015) {
      return {
        bouwperiode: '2003-2014 (Bouwbesluit 2003/2012)',
        outerLeafM: 0.1,
        cavityM: 0.14, // 11cm isolatie + 3cm spouw
        innerLeafM: 0.12,
        totalFacadeThicknessM: 0.36,
        partyWallThicknessM: 0.3,
        isAcousticDualLeaf: true,
        rcValue: 3.5,
      };
    }
    return {
      bouwperiode: '2015-Heden (BENG / BBL)',
      outerLeafM: 0.1,
      cavityM: 0.17, // 14cm isolatie + 3cm spouw
      innerLeafM: 0.15,
      totalFacadeThicknessM: 0.42,
      partyWallThicknessM: 0.32,
      isAcousticDualLeaf: true,
      rcValue: 4.7,
    };
  }

  /**
   * Berekent de binnenwaartse inspringing van de binnengevel
   * Bij een mandelige/ankerloze muur ligt de kadastrale erfgrens in het hart van de wand/spouw!
   */
  static getInwardOffset(isPartyWall: boolean, spec: WallSpecification): number {
    if (isPartyWall) {
      return spec.partyWallThicknessM / 2.0;
    }
    return spec.totalFacadeThicknessM;
  }
}
