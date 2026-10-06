import { Polygon2D } from '@/domain/geometry/polygon';
import { Point2D, Segment2D } from '@/domain/geometry/types';
import {
  BuildingHeightAttributes,
  FloorLevel,
  PartyWallSegment,
} from '@/domain/architectural/types';
import { NeighborBuilding, PartyWallDetector } from '@/domain/architectural/party-wall-detector';
import { FrontFacadeDetector } from '@/domain/architectural/front-facade-detector';
import { FloorBuilder } from '@/domain/architectural/floor-builder';
import { NEN2580Calculator } from '@/domain/architectural/nen2580-calculator';
import { LabelLayoutEngine } from '@/domain/architectural/label-layout-engine';

export interface TypologyRoom {
  id: string;
  name: string;
  polygon: Polygon2D;
  areaM2: number;
}

export interface TypologyDoor {
  id: string;
  hinge: Point2D;
  latch: Point2D;
  swingAngleDeg: number;
  direction: 'left' | 'right';
  label?: string;
}

export interface CrossSectionRoofPoint {
  x: number; // distance along section cut in meters (0 = front facade)
  y: number; // elevation in NAP meters
}

export interface BenchmarkTypology {
  id: string;
  slug: string;
  name: string;
  subType: string;
  description: string;
  address: {
    street: string;
    number: string;
    postalCode: string;
    city: string;
    formatted: string;
  };
  bagPandId: string;
  buildingPolygon: Polygon2D;
  neighboringBuildings: NeighborBuilding[];
  streetAxisLine: Segment2D;
  entrancePoint: Point2D;
  heightAttributes: BuildingHeightAttributes;
  rooms: TypologyRoom[];
  doors: TypologyDoor[];
  crossSectionAxis: {
    start: Point2D;
    end: Point2D;
  };
  roofProfile: CrossSectionRoofPoint[];
  lod: 'LoD1.2' | 'LoD1.3' | 'LoD2.2';
  yearBuilt: number;
  grossFloorAreaM2: number;
  usableAreaM2: number;
}

/**
 * 1. Rijwoning (Tussenwoning)
 * Mid-terrace house with dual full party walls (left and right), street frontage, pitched roof.
 */
const rijwoningTussen: BenchmarkTypology = {
  id: 'rijwoning_tussen',
  slug: 'rijwoning-tussen',
  name: 'Rijwoning (Tussenwoning)',
  subType: 'Tussenwoning',
  description: 'Klassieke Nederlandse tussenwoning met twee mandelige bouwmuurcontacten (links en rechts), straatzijde op het zuiden en zadeldak.',
  address: {
    street: 'Jan van Galenstraat',
    number: '42',
    postalCode: '1051 KM',
    city: 'Amsterdam',
    formatted: 'Jan van Galenstraat 42, 1051 KM Amsterdam',
  },
  bagPandId: '0363100012345678',
  buildingPolygon: new Polygon2D([
    { x: 120500.0, y: 487100.0 }, // Linksvoor (Zuid-West)
    { x: 120505.4, y: 487100.0 }, // Rechtsvoor (Zuid-Oost)
    { x: 120505.4, y: 487109.6 }, // Rechtsachter (Noord-Oost)
    { x: 120500.0, y: 487109.6 }, // Linksachter (Noord-West)
  ]),
  neighboringBuildings: [
    {
      id: 'pand_links_40',
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 120494.6, y: 487100.0 },
        { x: 120500.0, y: 487100.0 },
        { x: 120500.0, y: 487109.6 },
        { x: 120494.6, y: 487109.6 },
      ]),
    },
    {
      id: 'pand_rechts_44',
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 120505.4, y: 487100.0 },
        { x: 120510.8, y: 487100.0 },
        { x: 120510.8, y: 487109.6 },
        { x: 120505.4, y: 487109.6 },
      ]),
    },
  ],
  streetAxisLine: {
    p1: { x: 120485.0, y: 487094.0 },
    p2: { x: 120525.0, y: 487094.0 },
  },
  entrancePoint: { x: 120501.5, y: 487099.8 },
  heightAttributes: {
    groundLevelNAP: 0.85,
    eavesHeightNAP: 6.65, // Goothoogte = +5.80m t.o.v. maaiveld
    ridgeHeightNAP: 9.85, // Nokhoogte = +9.00m t.o.v. maaiveld
    roofType: 'zadeldak',
  },
  rooms: [
    {
      id: 'room_hal',
      name: 'Entree / Hal',
      polygon: new Polygon2D([
        { x: 120500.0, y: 487100.0 },
        { x: 120501.8, y: 487100.0 },
        { x: 120501.8, y: 487103.8 },
        { x: 120500.0, y: 487103.8 },
      ]),
      areaM2: 6.8,
    },
    {
      id: 'room_toilet',
      name: 'Toilet',
      polygon: new Polygon2D([
        { x: 120500.0, y: 487103.8 },
        { x: 120501.2, y: 487103.8 },
        { x: 120501.2, y: 487105.0 },
        { x: 120500.0, y: 487105.0 },
      ]),
      areaM2: 1.4,
    },
    {
      id: 'room_keuken',
      name: 'Keuken',
      polygon: new Polygon2D([
        { x: 120501.8, y: 487100.0 },
        { x: 120505.4, y: 487100.0 },
        { x: 120505.4, y: 487104.2 },
        { x: 120501.8, y: 487104.2 },
      ]),
      areaM2: 15.1,
    },
    {
      id: 'room_woonkamer',
      name: 'Woonkamer',
      polygon: new Polygon2D([
        { x: 120500.0, y: 487105.0 },
        { x: 120505.4, y: 487104.2 },
        { x: 120505.4, y: 487109.6 },
        { x: 120500.0, y: 487109.6 },
      ]),
      areaM2: 28.5,
    },
  ],
  doors: [
    {
      id: 'door_front',
      hinge: { x: 120501.1, y: 487100.0 },
      latch: { x: 120502.0, y: 487100.0 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Voordeur',
    },
    {
      id: 'door_living',
      hinge: { x: 120501.8, y: 487103.0 },
      latch: { x: 120501.8, y: 487103.9 },
      swingAngleDeg: 90,
      direction: 'left',
      label: 'Binnendeur',
    },
    {
      id: 'door_garden',
      hinge: { x: 120502.5, y: 487109.6 },
      latch: { x: 120503.4, y: 487109.6 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Tuindeur',
    },
  ],
  crossSectionAxis: {
    start: { x: 120502.7, y: 487100.0 },
    end: { x: 120502.7, y: 487109.6 },
  },
  roofProfile: [
    { x: 0.0, y: 6.65 },  // Voorgevel goot
    { x: 4.8, y: 9.85 },  // Nok (in het midden van 9.6m diepte)
    { x: 9.6, y: 6.65 },  // Achtergevel goot
  ],
  lod: 'LoD2.2',
  yearBuilt: 1938,
  grossFloorAreaM2: 128.0,
  usableAreaM2: 114.5,
};

/**
 * 2. Hoekwoning
 * End-terrace house with one party wall (left), one free wall (right), street frontage, gable roof.
 */
const hoekwoning: BenchmarkTypology = {
  id: 'hoekwoning',
  slug: 'hoekwoning',
  name: 'Hoekwoning',
  subType: 'Hoekwoning',
  description: 'Eindwoning van een rij met één mandelige muur (links), één vrije zijgevel met tuin (rechts), voorgevel op het zuiden en hoog zadeldak.',
  address: {
    street: 'Vondellaan',
    number: '1',
    postalCode: '3521 GA',
    city: 'Utrecht',
    formatted: 'Vondellaan 1, 3521 GA Utrecht',
  },
  bagPandId: '0344100098765432',
  buildingPolygon: new Polygon2D([
    { x: 136200.0, y: 454300.0 },
    { x: 136206.0, y: 454300.0 },
    { x: 136206.0, y: 454310.2 },
    { x: 136200.0, y: 454310.2 },
  ]),
  neighboringBuildings: [
    {
      id: 'pand_vondellaan_3',
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 136194.0, y: 454300.0 },
        { x: 136200.0, y: 454300.0 },
        { x: 136200.0, y: 454310.2 },
        { x: 136194.0, y: 454310.2 },
      ]),
    },
  ],
  streetAxisLine: {
    p1: { x: 136185.0, y: 454293.0 },
    p2: { x: 136225.0, y: 454293.0 },
  },
  entrancePoint: { x: 136201.8, y: 454299.8 },
  heightAttributes: {
    groundLevelNAP: 2.10,
    eavesHeightNAP: 8.10, // Goothoogte = +6.00m t.o.v. maaiveld
    ridgeHeightNAP: 11.60, // Nokhoogte = +9.50m t.o.v. maaiveld
    roofType: 'zadeldak',
  },
  rooms: [
    {
      id: 'hw_hal',
      name: 'Hal & Trap',
      polygon: new Polygon2D([
        { x: 136200.0, y: 454300.0 },
        { x: 136202.2, y: 454300.0 },
        { x: 136202.2, y: 454304.5 },
        { x: 136200.0, y: 454304.5 },
      ]),
      areaM2: 9.9,
    },
    {
      id: 'hw_keuken',
      name: 'Open Keuken',
      polygon: new Polygon2D([
        { x: 136202.2, y: 454300.0 },
        { x: 136206.0, y: 454300.0 },
        { x: 136206.0, y: 454304.5 },
        { x: 136202.2, y: 454304.5 },
      ]),
      areaM2: 17.1,
    },
    {
      id: 'hw_woonkamer',
      name: 'Woonkamer & Eethoek',
      polygon: new Polygon2D([
        { x: 136200.0, y: 454304.5 },
        { x: 136206.0, y: 454304.5 },
        { x: 136206.0, y: 454310.2 },
        { x: 136200.0, y: 454310.2 },
      ]),
      areaM2: 34.2,
    },
  ],
  doors: [
    {
      id: 'hw_door_front',
      hinge: { x: 136201.2, y: 454300.0 },
      latch: { x: 136202.1, y: 454300.0 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Voordeur',
    },
    {
      id: 'hw_door_rear',
      hinge: { x: 136203.5, y: 454310.2 },
      latch: { x: 136204.4, y: 454310.2 },
      swingAngleDeg: 90,
      direction: 'left',
      label: 'Schuifpui',
    },
  ],
  crossSectionAxis: {
    start: { x: 136203.0, y: 454300.0 },
    end: { x: 136203.0, y: 454310.2 },
  },
  roofProfile: [
    { x: 0.0, y: 8.10 },
    { x: 5.1, y: 11.60 },
    { x: 10.2, y: 8.10 },
  ],
  lod: 'LoD2.2',
  yearBuilt: 1965,
  grossFloorAreaM2: 153.0,
  usableAreaM2: 136.2,
};

/**
 * 3. Twee-onder-één-kap
 * Semi-detached house with one shared party wall (right), street frontage, pitched roof.
 */
const tweeOnderEenKap: BenchmarkTypology = {
  id: 'twee_onder_een_kap',
  slug: 'twee-onder-een-kap',
  name: 'Twee-onder-één-kap',
  subType: 'Twee-onder-een-kap',
  description: 'Ruime twee-onder-één-kapwoning met een gedeelde ankerloze spouwmuur (rechts) en vrije oprit/garagezone (links).',
  address: {
    street: 'Laan van Vathorst',
    number: '88',
    postalCode: '3825 AK',
    city: 'Amersfoort',
    formatted: 'Laan van Vathorst 88, 3825 AK Amersfoort',
  },
  bagPandId: '0307100055443322',
  buildingPolygon: new Polygon2D([
    { x: 153800.0, y: 466200.0 },
    { x: 153806.8, y: 466200.0 },
    { x: 153806.8, y: 466210.8 },
    { x: 153800.0, y: 466210.8 },
  ]),
  neighboringBuildings: [
    {
      id: 'pand_buur_86',
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 153806.8, y: 466200.0 },
        { x: 153813.6, y: 466200.0 },
        { x: 153813.6, y: 466210.8 },
        { x: 153806.8, y: 466210.8 },
      ]),
    },
  ],
  streetAxisLine: {
    p1: { x: 153785.0, y: 466192.0 },
    p2: { x: 153830.0, y: 466192.0 },
  },
  entrancePoint: { x: 153802.2, y: 466200.0 },
  heightAttributes: {
    groundLevelNAP: 4.20,
    eavesHeightNAP: 10.20, // Goothoogte = +6.00m t.o.v. maaiveld
    ridgeHeightNAP: 14.20, // Nokhoogte = +10.00m t.o.v. maaiveld
    roofType: 'zadeldak',
  },
  rooms: [
    {
      id: '2k_entree',
      name: 'Royale Entree',
      polygon: new Polygon2D([
        { x: 153800.0, y: 466200.0 },
        { x: 153802.6, y: 466200.0 },
        { x: 153802.6, y: 466204.5 },
        { x: 153800.0, y: 466204.5 },
      ]),
      areaM2: 11.7,
    },
    {
      id: '2k_keuken',
      name: 'Woonkeuken',
      polygon: new Polygon2D([
        { x: 153802.6, y: 466200.0 },
        { x: 153806.8, y: 466200.0 },
        { x: 153806.8, y: 466204.5 },
        { x: 153802.6, y: 466204.5 },
      ]),
      areaM2: 18.9,
    },
    {
      id: '2k_woonkamer',
      name: 'Tuingerichte Woonkamer',
      polygon: new Polygon2D([
        { x: 153800.0, y: 466204.5 },
        { x: 153806.8, y: 466204.5 },
        { x: 153806.8, y: 466210.8 },
        { x: 153800.0, y: 466210.8 },
      ]),
      areaM2: 42.8,
    },
  ],
  doors: [
    {
      id: '2k_door_front',
      hinge: { x: 153801.4, y: 466200.0 },
      latch: { x: 153802.3, y: 466200.0 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Voordeur',
    },
  ],
  crossSectionAxis: {
    start: { x: 153803.4, y: 466200.0 },
    end: { x: 153803.4, y: 466210.8 },
  },
  roofProfile: [
    { x: 0.0, y: 10.20 },
    { x: 5.4, y: 14.20 },
    { x: 10.8, y: 10.20 },
  ],
  lod: 'LoD2.2',
  yearBuilt: 2004,
  grossFloorAreaM2: 184.0,
  usableAreaM2: 165.2,
};

/**
 * 4. Vrijstaande Villa
 * Detached villa with all exterior free walls, multi-facet roof, surrounding parcel.
 */
const vrijstaandeVilla: BenchmarkTypology = {
  id: 'vrijstaande_villa',
  slug: 'vrijstaande-villa',
  name: 'Vrijstaande Villa',
  subType: 'Vrijstaand',
  description: 'Exclusieve vrijstaande villa met rondom vrije gevels (0% mandelig), samengesteld schilddak en ruime kavel.',
  address: {
    street: 'Groot Haesebroekseweg',
    number: '15',
    postalCode: '2243 EJ',
    city: 'Wassenaar',
    formatted: 'Groot Haesebroekseweg 15, 2243 EJ Wassenaar',
  },
  bagPandId: '0629100088776655',
  buildingPolygon: new Polygon2D([
    { x: 88900.0, y: 457200.0 },
    { x: 88912.0, y: 457200.0 },
    { x: 88912.0, y: 457211.5 },
    { x: 88900.0, y: 457211.5 },
  ]),
  neighboringBuildings: [
    {
      id: 'villa_buur_17',
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 88935.0, y: 457200.0 },
        { x: 88947.0, y: 457200.0 },
        { x: 88947.0, y: 457212.0 },
        { x: 88935.0, y: 457212.0 },
      ]),
    },
  ],
  streetAxisLine: {
    p1: { x: 88875.0, y: 457185.0 },
    p2: { x: 88940.0, y: 457185.0 },
  },
  entrancePoint: { x: 88906.0, y: 457200.0 },
  heightAttributes: {
    groundLevelNAP: 6.50,
    eavesHeightNAP: 13.00, // Goothoogte = +6.50m t.o.v. maaiveld
    ridgeHeightNAP: 17.50, // Nokhoogte = +11.00m t.o.v. maaiveld
    roofType: 'schilddak',
  },
  rooms: [
    {
      id: 'villa_hal',
      name: 'Centrale Hal & Vide',
      polygon: new Polygon2D([
        { x: 88904.0, y: 457200.0 },
        { x: 88908.0, y: 457200.0 },
        { x: 88908.0, y: 457205.0 },
        { x: 88904.0, y: 457205.0 },
      ]),
      areaM2: 20.0,
    },
    {
      id: 'villa_kantoor',
      name: 'Kantoor / Bibliotheek',
      polygon: new Polygon2D([
        { x: 88900.0, y: 457200.0 },
        { x: 88904.0, y: 457200.0 },
        { x: 88904.0, y: 457205.0 },
        { x: 88900.0, y: 457205.0 },
      ]),
      areaM2: 20.0,
    },
    {
      id: 'villa_woonkeuken',
      name: 'Woonkeuken',
      polygon: new Polygon2D([
        { x: 88908.0, y: 457200.0 },
        { x: 88912.0, y: 457200.0 },
        { x: 88912.0, y: 457205.5 },
        { x: 88908.0, y: 457205.5 },
      ]),
      areaM2: 22.0,
    },
    {
      id: 'villa_woonkamer',
      name: 'Grote Living & Salon',
      polygon: new Polygon2D([
        { x: 88900.0, y: 457205.0 },
        { x: 88912.0, y: 457205.5 },
        { x: 88912.0, y: 457211.5 },
        { x: 88900.0, y: 457211.5 },
      ]),
      areaM2: 74.0,
    },
  ],
  doors: [
    {
      id: 'villa_door_front',
      hinge: { x: 88905.4, y: 457200.0 },
      latch: { x: 88906.6, y: 457200.0 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Dubbele Entree',
    },
  ],
  crossSectionAxis: {
    start: { x: 88906.0, y: 457200.0 },
    end: { x: 88906.0, y: 457211.5 },
  },
  roofProfile: [
    { x: 0.0, y: 13.00 },
    { x: 3.5, y: 17.50 },
    { x: 8.0, y: 17.50 },
    { x: 11.5, y: 13.00 },
  ],
  lod: 'LoD2.2',
  yearBuilt: 1998,
  grossFloorAreaM2: 345.0,
  usableAreaM2: 312.0,
};

/**
 * 5. Verspringende Aanbouw
 * House with staggered rear extension, partial party wall, multi-level flat + pitched roof.
 */
const verspringendeAanbouw: BenchmarkTypology = {
  id: 'verspringende_aanbouw',
  slug: 'verspringende-aanbouw',
  name: 'Woning met Verspringende Aanbouw',
  subType: 'Tussenwoning met uitbouw',
  description: 'Stedelijke woning met een getrapte achtergeveluitbouw. Bevat een partiële mandelige wand (69.6% gedeeld links) en samengestelde daklijn (zadeldak + plat dak).',
  address: {
    street: 'Kleine Houtstraat',
    number: '74',
    postalCode: '2011 DS',
    city: 'Haarlem',
    formatted: 'Kleine Houtstraat 74, 2011 DS Haarlem',
  },
  bagPandId: '0392100033221100',
  buildingPolygon: new Polygon2D([
    { x: 103800.0, y: 488400.0 }, // 0: Voorgevel links
    { x: 103805.6, y: 488400.0 }, // 1: Voorgevel rechts
    { x: 103805.6, y: 488408.0 }, // 2: Achtergevel hoofdhuis rechts
    { x: 103803.6, y: 488408.0 }, // 3: Verspringing naar aanbouw
    { x: 103803.6, y: 488411.5 }, // 4: Achtergevel aanbouw rechts
    { x: 103800.0, y: 488411.5 }, // 5: Achtergevel aanbouw links
  ]),
  neighboringBuildings: [
    {
      id: 'pand_houtstraat_72', // Buurman links reikt maar tot y=488408 (geen aanbouw)
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 103794.4, y: 488400.0 },
        { x: 103800.0, y: 488400.0 },
        { x: 103800.0, y: 488408.0 },
        { x: 103794.4, y: 488408.0 },
      ]),
    },
    {
      id: 'pand_houtstraat_76', // Buurman rechts
      status: 'Pand in gebruik',
      polygon: new Polygon2D([
        { x: 103805.6, y: 488400.0 },
        { x: 103811.2, y: 488400.0 },
        { x: 103811.2, y: 488408.0 },
        { x: 103805.6, y: 488408.0 },
      ]),
    },
  ],
  streetAxisLine: {
    p1: { x: 103785.0, y: 488394.0 },
    p2: { x: 103820.0, y: 488394.0 },
  },
  entrancePoint: { x: 103801.4, y: 488400.0 },
  heightAttributes: {
    groundLevelNAP: 1.40,
    eavesHeightNAP: 7.40,  // Hoofdhuis goot = +6.00m t.o.v. maaiveld
    ridgeHeightNAP: 10.40, // Hoofdhuis nok = +9.00m t.o.v. maaiveld
    roofType: 'zadeldak_plat',
  },
  rooms: [
    {
      id: 'va_hal',
      name: 'Gang / Entree',
      polygon: new Polygon2D([
        { x: 103800.0, y: 488400.0 },
        { x: 103801.8, y: 488400.0 },
        { x: 103801.8, y: 488404.0 },
        { x: 103800.0, y: 488404.0 },
      ]),
      areaM2: 7.2,
    },
    {
      id: 'va_keuken',
      name: 'Keuken',
      polygon: new Polygon2D([
        { x: 103801.8, y: 488400.0 },
        { x: 103805.6, y: 488400.0 },
        { x: 103805.6, y: 488404.0 },
        { x: 103801.8, y: 488404.0 },
      ]),
      areaM2: 15.2,
    },
    {
      id: 'va_woonkamer',
      name: 'Centrale Woonkamer',
      polygon: new Polygon2D([
        { x: 103800.0, y: 488404.0 },
        { x: 103805.6, y: 488404.0 },
        { x: 103805.6, y: 488408.0 },
        { x: 103800.0, y: 488408.0 },
      ]),
      areaM2: 22.4,
    },
    {
      id: 'va_aanbouw',
      name: 'Tuinkamer (Aanbouw)',
      polygon: new Polygon2D([
        { x: 103800.0, y: 488408.0 },
        { x: 103803.6, y: 488408.0 },
        { x: 103803.6, y: 488411.5 },
        { x: 103800.0, y: 488411.5 },
      ]),
      areaM2: 12.6,
    },
  ],
  doors: [
    {
      id: 'va_door_front',
      hinge: { x: 103801.0, y: 488400.0 },
      latch: { x: 103801.9, y: 488400.0 },
      swingAngleDeg: 90,
      direction: 'right',
      label: 'Voordeur',
    },
    {
      id: 'va_door_garden',
      hinge: { x: 103801.5, y: 488411.5 },
      latch: { x: 103802.4, y: 488411.5 },
      swingAngleDeg: 90,
      direction: 'left',
      label: 'Tuindeur Aanbouw',
    },
  ],
  crossSectionAxis: {
    start: { x: 103801.8, y: 488400.0 },
    end: { x: 103801.8, y: 488411.5 },
  },
  roofProfile: [
    { x: 0.0, y: 7.40 },  // Voorgevel goot
    { x: 4.0, y: 10.40 }, // Hoofdhuis nok
    { x: 8.0, y: 7.40 },  // Achtergevel goot hoofdhuis
    { x: 8.0, y: 4.60 },  // Sprong naar plat dak aanbouw (+3.20m boven peil)
    { x: 11.5, y: 4.60 }, // Einde plat dak aanbouw
  ],
  lod: 'LoD2.2',
  yearBuilt: 1912,
  grossFloorAreaM2: 142.0,
  usableAreaM2: 124.8,
};

/**
 * All 5 benchmark building typologies.
 */
export const BENCHMARK_TYPOLOGIES: BenchmarkTypology[] = [
  rijwoningTussen,
  hoekwoning,
  tweeOnderEenKap,
  vrijstaandeVilla,
  verspringendeAanbouw,
];

export const BENCHMARK_TYPOLOGY_MAP: Record<string, BenchmarkTypology> = {
  rijwoning_tussen: rijwoningTussen,
  hoekwoning: hoekwoning,
  twee_onder_een_kap: tweeOnderEenKap,
  vrijstaande_villa: vrijstaandeVilla,
  verspringende_aanbouw: verspringendeAanbouw,
};

/**
 * Helper to analyze a typology with Domain Layer detectors
 */
export function analyzeTypology(typology: BenchmarkTypology) {
  // 1. Front Facade Detection
  const frontFacade = FrontFacadeDetector.detect(typology.buildingPolygon, {
    entrancePoint: typology.entrancePoint,
    streetCenterline: typology.streetAxisLine,
  });

  // 2. Party Wall Detection
  const partyWalls = PartyWallDetector.detect(
    typology.buildingPolygon,
    typology.neighboringBuildings
  );

  // 3. Floor Levels & Heights
  const floors = FloorBuilder.buildFloors(typology.heightAttributes);

  // 4. Mandelig wall stats
  const totalPerimeter = typology.buildingPolygon.perimeter();
  const sharedLength = partyWalls.reduce((sum, w) => sum + w.sharedLengthMeters, 0);
  const mandeligPercentage = totalPerimeter > 0 ? (sharedLength / totalPerimeter) * 100 : 0;
  const fullPartyWalls = partyWalls.filter((w) => w.classification === 'FULL').length;
  const partialPartyWalls = partyWalls.filter((w) => w.classification === 'PARTIAL').length;

  return {
    frontFacade,
    partyWalls,
    floors,
    mandeligStats: {
      totalPerimeter,
      sharedLength,
      mandeligPercentage,
      fullCount: fullPartyWalls,
      partialCount: partialPartyWalls,
      freeCount: typology.buildingPolygon.vertexCount - (fullPartyWalls + partialPartyWalls),
    },
  };
}
