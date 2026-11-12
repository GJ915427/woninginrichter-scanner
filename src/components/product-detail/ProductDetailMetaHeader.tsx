import React from 'react';
import { User, MapPin, Paperclip } from 'lucide-react';

export interface ProductDetailMetaHeaderProps {
  customerName: string;
  customerLocation: string;
  roomName: string;
  positionDescription: string;
  status: string;
  attachmentsCount: number;
  onAttachmentsClick?: () => void;
}

export const ProductDetailMetaHeader: React.FC<ProductDetailMetaHeaderProps> = ({
  customerName,
  customerLocation,
  roomName,
  positionDescription,
  status,
  attachmentsCount,
  onAttachmentsClick,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs">
        {/* Left: Customer & Location context */}
        <div className="flex flex-wrap items-center gap-3 text-slate-600">
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{customerName}</span>
          </div>
          <span className="hidden sm:inline text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{customerLocation}</span>
          </div>
        </div>

        {/* Center/Right: Badges & Attachments trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Micro labels */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600">
            <span className="text-slate-400 font-normal uppercase tracking-wider text-[10px]">Ruimte</span>
            <span className="font-semibold text-slate-800">{roomName}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600">
            <span className="text-slate-400 font-normal uppercase tracking-wider text-[10px]">Positie</span>
            <span className="font-semibold text-slate-800">{positionDescription}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-emerald-800">
            <span className="text-emerald-500 font-normal uppercase tracking-wider text-[10px]">Status</span>
            <div className="flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <span>{status}</span>
            </div>
          </div>

          {/* Attachments action with physical Fitts min-h-[44px] */}
          <button
            type="button"
            onClick={onAttachmentsClick}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium rounded-md border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Paperclip className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Bijlagen {attachmentsCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
