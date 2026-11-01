'use client';

import React, { useEffect, useState } from 'react';

interface MediaItem {
  id: number;
  type: 'foto' | 'video' | 'opmerking';
  title: string;
  timestamp: string;
  tag: string;
  url?: string;
  duration?: string;
  text?: string;
}

const INITIAL_MEDIA_ITEMS: MediaItem[] = [
  { id: 1, type: 'foto', title: 'Erker voorgevel situatie', timestamp: '2026-10-02 10:14', tag: 'Voorzijde', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80' },
  { id: 2, type: 'foto', title: 'Detail aansluiting schuifpui', timestamp: '2026-10-02 10:22', tag: 'Schuifpui', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80' },
  { id: 3, type: 'video', title: 'Inspectie nis en buisdiepte', timestamp: '2026-10-02 10:30', tag: 'Kamer 3', duration: '0:42 min' },
  { id: 4, type: 'opmerking', title: 'Let op: stucwerk is vers', text: 'Klant geeft aan dat stucwerk rondom erker pas vorige week is aangebracht. Voorzichtig boren bij montage.', timestamp: '2026-10-02 11:05', tag: 'Erker Voorgevel' }
];

interface MatrixMediaDrawerProps {
  isOpen: boolean;
  activeTab: 'foto' | 'video' | 'opmerking';
  onClose: () => void;
  onTabChange: (tab: 'foto' | 'video' | 'opmerking') => void;
}

export function MatrixMediaDrawer({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
}: MatrixMediaDrawerProps) {
  const [items, setItems] = useState<MediaItem[]>(INITIAL_MEDIA_ITEMS);
  const [newNote, setNewNote] = useState('');

  // WAI-ARIA Escape Listener
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredItems = items.filter((item) => item.type === activeTab);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const created: MediaItem = {
      id: Date.now(),
      type: activeTab,
      title: 'Snelle werfnotitie',
      text: newNote.trim(),
      timestamp: new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
      tag: 'Algemeen',
    };

    setItems((prev) => [created, ...prev]);
    setNewNote('');
  };

  return (
    <>
      {/* BACKDROP: z-35 (boven sticky headers z-20 en col 0 z-10) */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-35 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        aria-hidden="true"
      />

      {/* SLIDE-OVER DRAWER: z-40 met WAI-ARIA modal dialog contract */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-drawer-title"
        className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
      >
        {/* DRAWER HEADER */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 id="media-drawer-title" className="text-sm font-bold text-slate-900">
              Werf Media & Notities
            </h3>
            <p className="text-xs text-slate-500">
              Gekoppeld aan project- en positiedossier
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

        {/* TABS */}
        <div className="flex border-b border-slate-200 bg-white p-2 gap-1.5">
          <button
            type="button"
            onClick={() => onTabChange('foto')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'foto' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📷 Foto&apos;s
          </button>
          <button
            type="button"
            onClick={() => onTabChange('video')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'video' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🎥 Video&apos;s
          </button>
          <button
            type="button"
            onClick={() => onTabChange('opmerking')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'opmerking' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📝 Notities
          </button>
        </div>

        {/* ITEMS LIJST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="text-3xl block mb-2">
                {activeTab === 'foto' ? '📷' : activeTab === 'video' ? '🎥' : '📝'}
              </span>
              <p className="text-xs">Nog geen items in deze categorie.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono">
                    {item.tag}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.timestamp}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 mb-1">
                  {item.title}
                </div>
                {item.text && (
                  <p className="text-xs text-slate-600 leading-relaxed">{item.text}</p>
                )}
                {item.duration && (
                  <div className="mt-2 p-2 bg-white rounded border border-slate-200 text-xs font-mono text-slate-700">
                    ▶ Videobestand ({item.duration})
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* QUICK NOTE INPUT */}
        <form onSubmit={handleAddNote} className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Voeg snelle werfnotitie toe..."
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
