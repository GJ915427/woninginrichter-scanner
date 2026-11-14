import React from 'react';
import { Paperclip } from 'lucide-react';
import { CustomerContextBlock } from '../domain/CustomerContextBlock';
import { ActionButton } from '../ui/ActionButton';
import { StatusBadge } from '../ui/StatusBadge';
import { MicroLabel } from '../ui/MicroLabel';

export interface ProductDetailMetaHeaderProps {
  customerName: string;
  customerLocation: string;
  orderNumber?: string;
  roomName: string;
  positionDescription: string;
  status: string;
  attachmentsCount: number;
  onAttachmentsClick?: () => void;
  onSelectOrderId?: (orderId: string) => void;
  orders?: any[];
  selectedOrder?: any;
}

export const ProductDetailMetaHeader: React.FC<ProductDetailMetaHeaderProps> = ({
  customerName,
  customerLocation,
  orderNumber,
  roomName,
  positionDescription,
  status,
  attachmentsCount,
  onAttachmentsClick,
  onSelectOrderId,
  orders,
  selectedOrder,
}) => {
  return (
    <div
      aria-label="Product Context Metadata"
      className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-2xs text-xs select-none flex items-center justify-between gap-3 flex-wrap"
    >
      {/* Left: Universal Domain Customer Context Block */}
      <CustomerContextBlock
        customerName={customerName}
        orderNumber={orderNumber}
        address={customerLocation}
        onSelectOrderId={onSelectOrderId}
        orders={orders}
        selectedOrder={selectedOrder}
      />

      {/* Right: 2-Tier Stacked Micro-Labels & ActionButton */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Ruimte Micro-Label */}
        <MicroLabel
          label="RUIMTE"
          value={
            <span className="h-[28px] px-2.5 inline-flex items-center rounded-control bg-slate-100 border border-slate-200/80 text-slate-800 font-bold text-xs shadow-2xs">
              {roomName}
            </span>
          }
        />

        {/* Positie Micro-Label */}
        <MicroLabel
          label="POSITIE"
          value={
            <span className="h-[28px] px-2.5 inline-flex items-center rounded-control bg-slate-100 border border-slate-200/80 text-slate-800 font-bold text-xs shadow-2xs">
              {positionDescription}
            </span>
          }
        />

        {/* Status Micro-Label */}
        <MicroLabel
          label="STATUS"
          value={
            <StatusBadge label={status} tone="success" dot={true} className="h-[28px] font-bold text-xs shadow-2xs" />
          }
        />

        {/* Bijlagen Knop via ActionButton (>= 44x44px fysieke box) */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[9px] uppercase font-semibold text-slate-500 tracking-wider opacity-0 select-none hidden sm:inline">
            BIJLAGEN
          </span>
          <ActionButton
            variant="outline"
            onClick={onAttachmentsClick}
            className="font-semibold text-slate-700 shadow-2xs"
          >
            <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            <span>Bijlagen {attachmentsCount}</span>
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailMetaHeader;
