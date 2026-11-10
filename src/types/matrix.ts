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

export type PricingMode = 'm2' | 'm1_width' | 'm1_height' | 'unit';

export type DimensionSpec =
  | {
      type: 'window_2d';
      widthMm: number;
      heightMm: number;
      areaM2?: number;
    }
  | {
      type: 'floor_area';
      netAreaM2: number;
      wastePercentage: number;
      grossAreaM2?: number;
      packageSizeM2?: number;
      packageCount?: number;
    }
  | {
      type: 'curtain_linear';
      widthMm: number;
      heightMm?: number;
      pleatFactor?: number;
      fabricWidthMm?: number;
    }
  | {
      type: 'stairs';
      stepsCount: number;
      stairType: 'dicht' | 'open' | 'renovatie' | 'stoffering' | 'loper';
      hasRisers?: boolean;
      isOpen?: boolean;
      ledLighting?: boolean;
      bandering?: boolean;
      widthMm?: number;
    }
  | {
      type: 'piece_service';
      unit?: string;
    };

export interface DimensionLimits {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface CellPriceData {
  quantity: number;
  unit?: string;               // e.g. "st", "stel", "m²", "post"
  unitPriceCents: number;       // Invariante basis-stuksprijs in integer centen
  totalPriceCents: number;      // Berekend: quantity * unitPriceCents (of via dimensionale CPQ)
  dim?: string;                 // Dimensie / maatvoering (e.g. "1100 × 2240")
  note?: string;                // Specificatie (e.g. "TruFit MA", "Waveplooi op rail")
  line?: number;                // Referentie naar LogicTrade orderregel
  subPos?: string;              // Sub-positie letter ("a" | "b" | "c")
  isInbegrepen?: boolean;       // True voor stelposten / inbegrepen diensten
  baseRateCents?: number;       // Tarief per m² of m¹ in integer centen
  pricingMode?: PricingMode;    // Modus voor dimensionale berekening
  breedte_mm?: number;          // Breedte in mm
  hoogte_mm?: number;           // Hoogte in mm
  afmetingen?: string;          // Formatted string (e.g. "1100 × 2240")
  opmerking?: string;           // Vrije montagenotitie
  isCalculated?: boolean;       // Vlag voor dynamische calculatie
  dimensionSpec?: DimensionSpec; // Polymorfe domein-specificatie (Zero Data Loss)
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
  baseRateCents?: number;       // Tarief per m² / m¹
  pricingMode?: PricingMode;
  dimensionLimits?: DimensionLimits;
  posPrices: Record<string, CellPriceData>; // Sleutel is positionId of compound key: `${positionId}__${subPos}`
}

export interface FsmProcessStep {
  step: number;
  label: string;
  name?: string;
  status: 'voltooid' | 'actueel' | 'toekomstig' | 'actie_vereist' | 'completed' | 'in_progress' | 'pending' | 'blocked';
  badge?: string;
  actionRequired?: boolean;
  targetDate?: string;
  completedDate?: string;
  assignee?: string;
  notes?: string;
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

export interface MediaItem {
  id: string;
  entityType: 'order' | 'etage' | 'room' | 'vlak' | 'cluster' | 'position' | 'cell';
  entityId: string;
  type: 'photo' | 'video' | 'note';
  title: string;
  url?: string;
  date: string;
  author: string;
  thumbnailUrl?: string;
  description?: string;
}

export type ContextMenuType = 'etage' | 'room' | 'cluster' | 'position' | 'cell';

export type ActiveOverlay =
  | {
      type: 'context_menu';
      contextType?: ContextMenuType;
      menuType?: ContextMenuType;
      targetId?: string;
      positionId?: string;
      productId?: string;
      subPos?: string;
      cellKey?: string;
      contextTitle?: string;
      title?: string;
      anchorPosition?: { x: number; y: number };
      x?: number;
      y?: number;
      data?: any;
    }
  | {
      type: 'cell_edit';
      positionId: string;
      productId: string;
      orderLineId?: string;
      subPos?: string;
      cellKey?: string;
    }
  | {
      type: 'media' | 'media_drawer';
      positionId?: string;
      level?: 'order' | 'etage' | 'room' | 'vlak' | 'cluster' | 'position' | 'cell';
      entityId?: string;
      title?: string;
    }
  | {
      type: 'fsm_modal';
      step?: any;
      label?: string;
      status?: any;
      history?: any[];
    }
  | {
      type: 'stepper';
      productId: string;
      positionId: string;
    }
  | {
      type: 'cluster_modal';
      roomId: string;
      clusterId?: string;
      positionIds?: string[];
    }
  | {
      type: 'assign_vlak';
      positionId: string;
      currentVlak?: string;
      roomId?: string;
    }
  | {
      type: 'position_drawer';
      positionId: string;
    }
  | {
      type: 'product_drawer';
      productId: string;
    }
  | {
      type: 'level_visibility';
      anchorPosition: { x: number; y: number };
    };

export interface OrderSummaryItem {
  id: string;
  orderNumber: string;
  klant: string;
  plaats: string;
  offerte?: string;
  orderdatum: string;
  totaalbedragCents: number;
  status: string;
  positionCount?: number;
}

export interface OrderLinePatchDto {
  quantity?: number;
  unit_price_cents?: number;
  total_price_cents?: number;
  dim?: string;
  notes?: string;
  dimension_spec?: Record<string, unknown>;
}

export interface MatrixOrder {
  id: string;                   // e.g. "V26001376"
  isLive?: boolean;             // True wanneer order gehydrateerd is uit Supabase database
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
  historisch_document_url?: string; // Optionele link naar origineel LogicTrade brondocument
  etages: Etage[];
  products: MatrixProduct[];
  rawLines?: LogicTradeOrderLine[];
  media?: MediaItem[];
}

export type RollupLevel = 'positie' | 'ruimte' | 'etage';

export interface HeaderLevelVisibility {
  etage: boolean;
  ruimte: boolean;
  cluster: boolean;
  positie: boolean; // Altijd true (vast niveau)
}

export interface MatrixProductDetailDrawerProps {
  product: MatrixProduct | null;
  onClose: () => void;
  onAddNote?: (note: string) => void;
  positions?: Position[];
  isOpen?: boolean;
}

export interface MatrixMediaCardProps {
  item: MediaItem;
  onPreview?: (item: MediaItem) => void;
}

export interface MatrixMediaInlineFormProps {
  onSubmit: (title: string, description: string) => void;
}


