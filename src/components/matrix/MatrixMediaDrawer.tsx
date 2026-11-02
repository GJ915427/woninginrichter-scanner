'use client';

import React, { useEffect, useState } from 'react';
import { MediaItem } from '../../types/matrix';
import { MatrixMediaFilterTabs } from './MatrixMediaFilterTabs';

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
 * Slide-over drawer voor werfmedia conform INV-GOV-22 (<250 regels).
 * Ondersteunt filtering op type en context (positie, ruimte, project).
 */
export function MatrixMediaDrawer({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  items: initialItems,
  currentPositionId = 'pos_wk_pui',
  currentRoomId = 'room_woonkamer',
  onAddNote,
}: MatrixMediaDrawerProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>(initialItems ?? DEFAULT_MEDIA_ITEMS);
  const [contextFilter, setContextFilter] = useState<'position' | 'room' | 'project'>('project');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setMediaList(initialItems);
    }
  }, [initialItems]);

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
    // Type filter
    const matchesType =
      (activeTab === 'foto' && item.type === 'photo') ||
      (activeTab === 'video' && item.type === 'video') ||
      (activeTab === 'opmerking' && item.type === 'note');

    if (!matchesType) return false;

    // Context filter
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

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const created: MediaItem = {
      id: `med_${Date.now()}`,
      entityType: contextFilter === 'position' ? 'position' : 'order',
      entityId: contextFilter === 'position' ? currentPositionId : 'V26001376',
      type: 'note',
      title: 'Werfnotitie',
      date: new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
      author: 'Carlo Heinemans',
      description: newNote.trim(),
    };

    setMediaList((prev) => [created, ...prev]);
    onAddNote?.(newNote.trim());
    setNewNote('');
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
              Werf Media & Notities
            </h3>
            <p className="text-xs text-slate-500">
              Gekoppeld op niveau van order, ruimte en positie
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-base"
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

        {/* Media Item Lijst */}
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
              <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs">
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
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                )}
                {item.url && item.type === 'photo' && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.title} className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Notitie Invoer */}
        <form onSubmit={handleCreateNote} className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Voeg werfnotitie toe..."
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            +
          </button>
        </form>
      </div>
    </>
  );
}
