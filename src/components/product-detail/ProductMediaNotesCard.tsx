import React from 'react';
import { Camera, FileText, Plus, AlertTriangle, ArrowRight } from 'lucide-react';
import { FeedItem } from '../../types/product-detail';

export interface ProductMediaNotesCardProps {
  feedItems: Array<FeedItem>;
  onAddPhoto?: () => void;
  onAddNote?: () => void;
  onItemAction?: (itemId: string) => void;
}

export const ProductMediaNotesCard: React.FC<ProductMediaNotesCardProps> = ({
  feedItems,
  onAddPhoto,
  onAddNote,
  onItemAction,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50 gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Media & Notities</h2>
        </div>

        {/* Action Triggers with physical Fitts min-h-[44px] */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddPhoto}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>+ Foto</span>
          </button>

          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>+ Notitie</span>
          </button>
        </div>
      </div>

      {/* Feed Items Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {feedItems.map((item) => {
          if (item.type === 'note') {
            return (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{item.author}</span>
                      <span className="text-slate-500 text-[10px] bg-slate-200/70 px-1.5 py-0.2 rounded font-medium">
                        {item.role}
                      </span>
                    </div>
                    <span className="text-slate-400">{item.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onItemAction?.(item.id)}
                    className="inline-flex items-center min-h-[44px] text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {item.actionLabel || 'Beantwoorden'}
                  </button>
                </div>
              </div>
            );
          }

          if (item.type === 'issue') {
            return (
              <div
                key={item.id}
                className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      <span>Issue {item.badge}</span>
                    </div>
                  </div>

                  {item.title && (
                    <div className="text-xs font-bold text-amber-950 mb-1">
                      {item.title}
                    </div>
                  )}

                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-amber-800 font-medium">{item.priority}</span>
                  <button
                    type="button"
                    onClick={() => onItemAction?.(item.id)}
                    className="inline-flex items-center gap-1 min-h-[44px] font-bold text-amber-900 hover:text-amber-950 transition-colors"
                  >
                    <span>{item.actionLabel || 'Details bekijken'}</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          }

          if (item.type === 'photo') {
            return (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between"
              >
                {/* Simulated photo visual container */}
                <div className="relative h-28 bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 via-transparent to-transparent z-10" />
                  <Camera className="w-8 h-8 opacity-40" aria-hidden="true" />
                  <div className="absolute bottom-2 left-2 z-20">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] rounded font-semibold tracking-wide">
                      {item.title}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{item.description}</span>
                  <button
                    type="button"
                    onClick={() => onItemAction?.(item.id)}
                    className="inline-flex items-center min-h-[44px] text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {item.actionLabel || '+ Notitie'}
                  </button>
                </div>
              </div>
            );
          }

          // planning type
          return (
            <div
              key={item.id}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{item.author}</span>
                    <span className="text-slate-500 text-[10px] bg-slate-200/70 px-1.5 py-0.2 rounded font-medium">
                      {item.role}
                    </span>
                  </div>
                  <span className="text-slate-400">{item.timestamp}</span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-medium text-[10px]">
                  {item.badge}
                </span>
                <button
                  type="button"
                  onClick={() => onItemAction?.(item.id)}
                  className="inline-flex items-center min-h-[44px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {item.actionLabel || 'Bewerken'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
