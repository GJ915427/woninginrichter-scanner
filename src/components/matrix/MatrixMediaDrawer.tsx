'use client';

import React, { useEffect, useState } from 'react';
import { MediaItem } from '../../types/matrix';
import { MatrixMediaFilterTabs } from './MatrixMediaFilterTabs';
import { MatrixMediaCard } from './MatrixMediaCard';
import { MatrixMediaInlineForm } from './MatrixMediaInlineForm';

export interface MatrixMediaDrawerProps {
  isOpen: boolean;
  activeTab: 'foto' | 'video' | 'opmerking';
  onClose: () => void;
  onTabChange: (tab: 'foto' | 'video' | 'opmerking') => void;
  items?: MediaItem[];
  currentPositionId?: string;
  currentRoomId?: string;
  onAddNote?: (note: string) => void;
}

const DEFAULT_MEDIA_ITEMS: MediaItem[] = [
  {
    id: 'med_init_01',
    entityType: 'order',
    entityId: 'V26001376',
    type: 'photo',
    title: 'Voorgevel Villa Maastricht',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    date: '07 aug 2026',
    author: 'Carlo Heinemans',
    description: 'Overzichtsfoto exterieur t.b.v. montageploeg.',
  },
  {
    id: 'med_init_02',
    entityType: 'room',
    entityId: 'room_woonkamer',
    type: 'photo',
    title: 'Woonkamer Erker & Pui',
    url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    date: '08 aug 2026',
    author: 'Inmeter Jan',
    description: 'Overzicht van de erker met 3 ramen en de schuifpui.',
  },
  {
    id: 'med_init_03',
    entityType: 'position',
    entityId: 'pos_wk_pui',
    type: 'photo',
    title: 'Detail Schuifpui Bovenzijde',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    date: '08 aug 2026',
    author: 'Inmeter Jan',
    description: 'Montagestrook schuifpui voor wave-gordijn en Duette rails.',
  },
  {
    id: 'med_init_04',
    entityType: 'position',
    entityId: 'pos_wk_pui',
    type: 'note',
    title: 'Montage-aandachtspunt Pui',
    date: '08 aug 2026',
    author: 'Inmeter Jan',
    description: 'Let op: nisdiepte 140mm. Rail monteren op 40mm vanaf glas.',
  },
  {
    id: 'med_init_05',
    entityType: 'order',
    entityId: 'V26001376',
    type: 'video',
    title: 'Werfvideo Draaicirkel Pui',
    date: '08 aug 2026',
    author: 'Carlo Heinemans',
    description: 'Korte videoinspectie van de draairichting schuifpui.',
  },
];

/**
 * Slide-over drawer voor werfmedia & tijdlijn conform INV-GOV-22 (<250 regels, 2 hooks).
 * Ondersteunt filtering op type en context (positie, ruimte, project).
 */
export function MatrixMediaDrawer({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  items,
  currentPositionId = 'pos_wk_pui',
  currentRoomId = 'room_woonkamer',
  onAddNote,
}: MatrixMediaDrawerProps) {
  const [contextFilter, setContextFilter] = useState<'position' | 'room' | 'project'>('project');
  const mediaList = items && items.length > 0 ? items : DEFAULT_MEDIA_ITEMS;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Multi-level context & type filtering
  const filteredItems = mediaList.filter((item) => {
    const matchesType =
      (activeTab === 'foto' && item.type === 'photo') ||
      (activeTab === 'video' && item.type === 'video') ||
      (activeTab === 'opmerking' && item.type === 'note');

    if (!matchesType) return false;

    if (contextFilter === 'position') {
      return item.entityType === 'position' && item.entityId === currentPositionId;
    }
    if (contextFilter === 'room') {
      return (
        (item.entityType === 'room' && item.entityId === currentRoomId) ||
        (item.entityType === 'position' && item.entityId === currentPositionId)
      );
    }
    return true; // project: alles tonen
  });

  const handleCreateNote = (_title: string, description: string) => {
    onAddNote?.(description);
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-35 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-drawer-title"
        className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 id="media-drawer-title" className="text-sm font-bold text-slate-900">
              Werf Media &amp; Notities
            </h3>
            <p className="text-xs text-slate-500">
              Gekoppeld op niveau van order, ruimte en positie
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-base"
            aria-label="Sluit drawer"
          >
            ✕
          </button>
        </div>

        {/* Filter Tabs Decompositie */}
        <MatrixMediaFilterTabs
          activeTypeTab={activeTab}
          onTypeTabChange={onTabChange}
          activeContextFilter={contextFilter}
          onContextFilterChange={setContextFilter}
          hasActivePosition={Boolean(currentPositionId)}
        />

        {/* Media Item Lijst gedelegeerd naar MatrixMediaCard */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-3xl block mb-2">
                {activeTab === 'foto' ? '📷' : activeTab === 'video' ? '🎥' : '📝'}
              </span>
              <p className="text-xs">Geen items gevonden voor dit contextfilter.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <MatrixMediaCard key={item.id} item={item} />
            ))
          )}
        </div>

        {/* Notitie Invoer gedelegeerd naar MatrixMediaInlineForm */}
        <MatrixMediaInlineForm onSubmit={handleCreateNote} />
      </div>
    </>
  );
}
