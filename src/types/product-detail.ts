/**
 * EasyM2M Product Detail Domain Contracts (SSOT)
 * Hoofdscherm 6: Product (Detail)
 */

export interface MeasurementAxis {
  points: [number, number, number]; // [B1, B2, B3] of [H1, H2, H3]
  minRawMm: number;
  deductionMm: number;
  formulaDescription: string;
  finalProductionMm: number;
}

export interface FeedItem {
  id: string;
  type: 'note' | 'issue' | 'photo' | 'planning';
  author?: string;
  role?: string;
  timestamp?: string;
  title?: string;
  description: string;
  imageUrl?: string;
  badge?: string;
  badgeVariant?: 'info' | 'warning' | 'success';
  priority?: string;
  actionLabel?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  checked: boolean;
  detail: string;
}

export interface ProductDetailData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerLocation: string;
  roomName: string;
  positionCode: string;
  positionDescription: string;
  status: 'Definitief' | 'In bewerking' | 'Concept';
  fsmStage: string;
  attachmentsCount: number;
  productName: string;
  productCategory: string;
  measurements: {
    width: MeasurementAxis;
    height: MeasurementAxis;
    installationHeightMm: number;
    isInstallationHeightFixed: boolean;
  };
  priceCents: number;
  specifications: {
    fabric: string;
    profileColor: string;
    operation: string;
    mountType: string;
    stackHeight: string;
  };
  checklists: Array<ChecklistItem>;
  bracketInfo: {
    mountDescription: string;
    colorCode: string;
    supportLeft: string;
    supportRight: string;
    centerSupport: string;
  };
  feedItems: Array<FeedItem>;
}
