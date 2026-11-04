'use client';

import React from 'react';
import { MatrixMediaCardProps } from '../../types/matrix';

/**
 * MatrixMediaCard (INV-GOV-22)
 * Pure presentational card component voor werfmedia & notities.
 * 0 hooks, <80 regels.
 */
export function MatrixMediaCard({ item, onPreview }: MatrixMediaCardProps) {
  return (
    <div
      className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-colors"
      onClick={() => onPreview?.(item)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono">
          {item.entityType}: {item.entityId}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {item.date}
        </span>
      </div>

      <div className="font-bold text-xs text-slate-900 mb-1">
        {item.title}
      </div>

      {item.description && (
        <p className="text-xs text-slate-600 leading-relaxed">
          {item.description}
        </p>
      )}

      {item.url && item.type === 'photo' && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.title}
            className="w-full h-32 object-cover hover:scale-105 transition-transform duration-200"
          />
        </div>
      )}
    </div>
  );
}
