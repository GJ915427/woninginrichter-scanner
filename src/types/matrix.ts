/**
 * src/types/matrix.ts
 *
 * Domain-Driven Design (DDD) CPQ type contracts voor de Matrix Orders Browser.
 * Strikt client-safe zonder afhankelijkheid van Node.js runtime scripts (fs, path).
 */

export interface LogicTradeOrderLine {
  line: number;
  productCode?: string;
  description: string;
  quantity: number;
  unit?: string;
  priceCents: number;
  totalCents: number;
  positionName?: string;
  roomName?: string;
  etageName?: string;
}

export interface CellPriceData {
  quantity: number;
  unit?: string;               // e.g. "st", "stel", "m²", "post"
  unitPriceCents: number;       // Invariante basis-stuksprijs in integer centen
  totalPriceCents: number;      // Berekend: quantity * unitPriceCents
  dim?: string;                 // Dimensie / maatvoering (e.g. "1100 × 1005")
  note?: string;                // Specificatie (e.g. "TruFit MA", "Waveplooi op rail")
  line?: number;                // Referentie naar LogicTrade orderregel
  subPos?: string;              // Sub-positie letter ("a" | "b" | "c")
  isInbegrepen?: boolean;       // True voor stelposten / inbegrepen diensten
}

export interface Position {
  id: string;
  name: string;
  type: string;                 // e.g. "Raam", "Vloer", "Algemeen"
  vlak?: string;                // e.g. "Wand Voorgevel", "Erker Voorgevel"
  subPositions?: string[];      // e.g. ["a", "b"]
}

export interface Cluster {
  id: string;
  name: string;                 // e.g. "Erker Voorgevel (3 ramen)"
  positionIds: string[];
}

export interface Room {
  id: string;
  name: string;                 // e.g. "Hal / Voordeur", "Woonkamer"
  clusters: Cluster[];
  positions: Position[];
}

export interface Etage {
  id: string;
  name: string;                 // e.g. "BEGANE GROND", "1e VERDIEPING"
  rooms: Room[];
}

export interface MatrixProduct {
  id: string;
  code: string;                 // e.g. "A00034988", "A000866057"
  name: string;                 // e.g. "GIW Duette® 32mm SmartCord TDBU"
  category: string;             // e.g. "Dienst / Service", "Raambekleding", "Gordijnen"
  unit: string;                 // e.g. "keer", "stuks", "stel"
  posPrices: Record<string, CellPriceData>;
}

export interface FsmProcessStep {
  step: number;
  label: string;
  status: 'voltooid' | 'actueel' | 'toekomstig' | 'actie_vereist';
  badge?: string;
  actionRequired?: boolean;
}

export const FSM_STAGES: readonly FsmProcessStep[] = [
  { step: 1, label: 'Lead / Intake', status: 'voltooid' },
  { step: 2, label: 'Offerte', status: 'voltooid' },
  { step: 3, label: 'Inmeten', status: 'voltooid' },
  { step: 4, label: 'Werkvoorbereiding', status: 'voltooid' },
  { step: 5, label: 'Bestellen', status: 'actueel' },
  { step: 6, label: 'Goederenontvangst', status: 'toekomstig', actionRequired: true, badge: '⚠️' },
  { step: 7, label: 'Montage', status: 'toekomstig', actionRequired: true, badge: '⚠️' },
  { step: 8, label: 'Facturatie', status: 'toekomstig', actionRequired: true, badge: '⚠️' },
] as const;

export interface MatrixOrder {
  id: string;                   // e.g. "V26001376"
  klant: string;                // e.g. "Jaspers"
  plaats: string;               // e.g. "Maastricht"
  offerte: string;              // e.g. "O26000865"
  orderdatum: string;           // e.g. "07 aug 2026"
  status: string;               // e.g. "Definitief"
  fsmPhase: string;             // e.g. "5. Bestellen (Actueel)"
  fsmStep: number;              // e.g. 5
  verkoper: string;             // e.g. "Carlo Heinemans"
  filiaal: string;              // e.g. "Winkel GSW BV"
  totaalbedragCents: number;    // e.g. 1925000 voor € 19.250,00
  scopeDescription?: string;    // e.g. "Complete Villa: 18x Duette® over 6 Kamers"
  positionCount?: number;       // e.g. 15
  orderlineCount?: number;      // e.g. 10
  etages: Etage[];
  products: MatrixProduct[];
  rawLines?: LogicTradeOrderLine[];
}

export type RollupLevel = 'positie' | 'ruimte' | 'etage';
