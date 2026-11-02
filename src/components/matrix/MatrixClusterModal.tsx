'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface MatrixClusterModalProps {
  isOpen: boolean;
  roomId: string;
  clusterId?: string;
  positionIds?: string[];
  currentName?: string;
  onSave: (roomId: string, clusterName: string, positionIds: string[]) => void;
  onDissolve?: (roomId: string, clusterId: string) => void;
  onClose: () => void;
}

const CLUSTER_SUGGESTIONS = [
  'Erker Voorgevel',
  'Schuifpui Achtergevel',
  'Zithoek Ramen',
  'Eethoek Pui',
  'Dakkapel Voorzijde',
  'Vide Gevel',
];

export function MatrixClusterModal({
  isOpen,
  roomId,
  clusterId,
  positionIds = [],
  currentName = '',
  onSave,
  onDissolve,
  onClose,
}: MatrixClusterModalProps) {
  const [clusterName, setClusterName] = useState<string>(currentName);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClusterName(currentName);
  }, [currentName, isOpen]);

  // Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clusterName.trim()) {
      onSave(roomId, clusterName.trim(), positionIds);
      onClose();
    }
  };

  const handleDissolve = () => {
    if (clusterId && onDissolve) {
      onDissolve(roomId, clusterId);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cluster-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔗</span>
            <div>
              <h3 id="cluster-modal-title" className="text-base font-bold text-slate-900">
                {clusterId ? 'Cluster Beheren' : 'Nieuw Positiecluster'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Ruimte: {roomId} {positionIds.length > 0 && `• ${positionIds.length} posities geselecteerd`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluit dialoogvenster"
            className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="cluster-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              Clusternaam
            </label>
            <input
              id="cluster-name-input"
              type="text"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="bv. Erker Voorgevel (3 ramen)..."
              required
              className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Suggesties
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CLUSTER_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setClusterName(sug)}
                  className="px-2.5 py-1.5 min-h-[36px] text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {clusterId && onDissolve ? (
              <button
                type="button"
                onClick={handleDissolve}
                className="px-3 py-2 min-h-[44px] text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Ontbinden
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[44px] min-w-[80px] text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={!clusterName.trim()}
                className="px-5 py-2.5 min-h-[44px] min-w-[100px] text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {clusterId ? 'Bijwerken' : 'Samenvoegen'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
