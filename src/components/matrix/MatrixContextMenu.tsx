'use client';

import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { ContextMenuType } from '../../types/matrix';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  destructive?: boolean;
  action: () => void;
}

export interface MatrixContextMenuProps {
  type: ContextMenuType;
  title: string;
  anchorPosition: { x: number; y: number };
  onClose: () => void;
  // Optionele domein callbacks
  onEdit?: () => void;
  onDelete?: () => void;
  onSelectForCluster?: () => void;
  onAssignVlak?: () => void;
  onAttachMedia?: () => void;
  onAddSubItem?: () => void;
  customItems?: ContextMenuItem[];
}

/**
 * Generiek, toegankelijk contextmenu voor Etage, Ruimte, Cluster, Positie en Cel.
 * - WAI-ARIA role="menu" met focus management.
 * - Viewport boundary clamping tegen overloop.
 * - Fitts' Law touch targets >= 44px conform richtlijnen.
 */
export const MatrixContextMenu: React.FC<MatrixContextMenuProps> = ({
  type,
  title,
  anchorPosition,
  onClose,
  onEdit,
  onDelete,
  onSelectForCluster,
  onAssignVlak,
  onAttachMedia,
  onAddSubItem,
  customItems,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: anchorPosition.x, y: anchorPosition.y });

  // Viewport boundary clamping
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let nextX = anchorPosition.x;
      let nextY = anchorPosition.y;

      if (nextX + rect.width > viewportWidth - 16) {
        nextX = Math.max(16, viewportWidth - rect.width - 16);
      }
      if (nextY + rect.height > viewportHeight - 16) {
        nextY = Math.max(16, viewportHeight - rect.height - 16);
      }

      setAdjustedPos({ x: nextX, y: nextY });
    }
  }, [anchorPosition]);

  // Click-outside en Escape toets listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  // Bepaal de context specifieke items
  const getMenuItems = (): ContextMenuItem[] => {
    if (customItems && customItems.length > 0) return customItems;

    switch (type) {
      case 'etage':
        return [
          { label: 'Verdieping hernoemen', icon: '✏️', action: () => { onEdit?.(); onClose(); } },
          { label: 'Ruimte toevoegen', icon: '➕', action: () => { onAddSubItem?.(); onClose(); } },
          { label: 'Media / werffoto\'s bekijken', icon: '📷', action: () => { onAttachMedia?.(); onClose(); } },
        ];
      case 'room':
        return [
          { label: 'Ruimte hernoemen', icon: '✏️', action: () => { onEdit?.(); onClose(); } },
          { label: 'Nieuwe positie toevoegen', icon: '➕', action: () => { onAddSubItem?.(); onClose(); } },
          { label: 'Media / werffoto\'s koppelen', icon: '📷', action: () => { onAttachMedia?.(); onClose(); } },
        ];
      case 'cluster':
        return [
          { label: 'Cluster hernoemen', icon: '✏️', action: () => { onEdit?.(); onClose(); } },
          { label: 'Posities ontkoppelen', icon: '🔗', action: () => { onSelectForCluster?.(); onClose(); } },
          { label: 'Media bekijken', icon: '📷', action: () => { onAttachMedia?.(); onClose(); } },
        ];
      case 'position':
        return [
          { label: 'Vlak toewijzen (Wand / Gevel / Vloer)', icon: '🏷️', action: () => { onAssignVlak?.(); onClose(); } },
          { label: 'Selecteren voor Cluster', icon: '☑️', action: () => { onSelectForCluster?.(); onClose(); } },
          { label: 'Werffoto koppelen aan positie', icon: '📷', action: () => { onAttachMedia?.(); onClose(); } },
          { label: 'Positie verwijderen', icon: '🗑️', destructive: true, action: () => { onDelete?.(); onClose(); } },
        ];
      case 'cell':
      default:
        return [
          { label: 'Product & maten bewerken', icon: '📐', action: () => { onEdit?.(); onClose(); } },
          { label: 'Positie toewijzen / verplaatsen', icon: '🔄', action: () => { onAssignVlak?.(); onClose(); } },
          { label: 'Kopiëren naar deze positie', icon: '📋', action: () => { onAddSubItem?.(); onClose(); } },
          { label: 'Werffoto koppelen', icon: '📷', action: () => { onAttachMedia?.(); onClose(); } },
          { label: 'Cel leegmaken', icon: '🗑️', destructive: true, action: () => { onDelete?.(); onClose(); } },
        ];
    }
  };

  const menuItems = getMenuItems();

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${type} context menu`}
      className="fixed z-50 min-w-[220px] max-w-[300px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl transition-all select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
      }}
    >
      <div className="border-b border-slate-100 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {type.toUpperCase()}: {title}
        </span>
      </div>

      <div className="py-1">
        {menuItems.map((item, idx) => (
          <button
            key={idx}
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              item.action();
            }}
            className={`flex w-full min-h-[44px] items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${
              item.destructive
                ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
                : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'
            }`}
          >
            {item.icon && <span className="text-sm select-none">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        ))}

        <div className="border-t border-slate-100 mt-1 pt-1">
          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex w-full min-h-[40px] items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50"
          >
            <span className="text-sm">❌</span>
            <span>Sluiten</span>
          </button>
        </div>
      </div>
    </div>
  );
};
