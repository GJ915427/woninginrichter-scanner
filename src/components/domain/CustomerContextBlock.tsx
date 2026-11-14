'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { MicroLabel } from '../ui/MicroLabel';
import { MatrixOrderPickerPopover } from '../matrix/MatrixOrderPickerPopover';

export interface CustomerContextBlockProps {
  customerName: string;
  orderNumber?: string;
  address?: string;
  selectedOrder?: any;
  orders?: any[];
  currentOrderIndex?: number;
  onSelectOrder?: (index: number) => void;
  onSelectOrderId?: (orderId: string) => void;
  className?: string;
}

export const CustomerContextBlock: React.FC<CustomerContextBlockProps> = ({
  customerName,
  orderNumber,
  address,
  selectedOrder,
  orders = [],
  currentOrderIndex = 0,
  onSelectOrder,
  onSelectOrderId,
  className = '',
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPopoverOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  // Sluit popover bij orderwissel
  useEffect(() => {
    setIsPopoverOpen(false);
  }, [selectedOrder?.id, currentOrderIndex]);

  const orderList = orders && orders.length > 0 ? orders : (selectedOrder ? [selectedOrder] : []);

  return (
    <div className={`flex items-center gap-3 flex-wrap sm:flex-nowrap min-w-0 ${className}`}>
      {/* Klantnaam Trigger Container */}
      <div className="flex items-center gap-1.5 min-w-0 relative" ref={popoverRef}>
        <button
          type="button"
          id="meta-customer-name"
          aria-haspopup="listbox"
          aria-expanded={isPopoverOpen}
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className="font-bold text-sm text-slate-900 truncate min-h-[44px] inline-flex items-center gap-1.5 hover:text-slate-700 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 rounded-control px-1 -mx-1"
          title="Klik om een order te selecteren"
        >
          <span className="truncate">{customerName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
        </button>

        <MatrixOrderPickerPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          selectedOrder={selectedOrder}
          orders={orderList}
          currentOrderIndex={currentOrderIndex}
          onSelectOrder={onSelectOrder}
          onSelectOrderId={onSelectOrderId}
        />
      </div>

      {/* Ordernummer MicroLabel */}
      {orderNumber && (
        <div className="hidden sm:flex items-center">
          <span className="text-slate-300 select-none mr-3" aria-hidden="true">|</span>
          <MicroLabel label="Ordernummer" value={orderNumber} />
        </div>
      )}

      {/* Adres Container */}
      {address && (
        <>
          <span className="text-slate-300 select-none hidden sm:inline" aria-hidden="true">|</span>
          <div className="flex items-center gap-1 text-slate-600 truncate text-xs">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate" title={address}>{address}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerContextBlock;
