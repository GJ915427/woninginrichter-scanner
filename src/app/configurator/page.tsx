'use client';

import React, { useState } from 'react';
import { LiveProductSearch } from '@/components/configurator/LiveProductSearch';
import { DynamicConfiguratorForm } from '@/components/configurator/DynamicConfiguratorForm';
import { SearchResultItem } from '@/types/product';
import { ProductConfigValues } from '@/types/configurator';

export default function ConfiguratorPage() {
  const [selectedProduct, setSelectedProduct] = useState<SearchResultItem | null>(null);
  const [configValues, setConfigValues] = useState<ProductConfigValues>({});

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
            M2M
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">EasyM2M Configurator</h1>
            <p className="text-xs text-slate-400">Fase 2: Productgroep-Herkenning & Dynamische Velden (Focus: Vorm)</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>LogicTrade Cloud REST API (100.719 artikelen)</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8 flex flex-col items-center">
        <div className="text-center mb-8 max-w-xl">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
            Artikel Zoeken & Configureren
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Zoek op leverancier, artikelcode of omschrijving. Het formulier past zich automatisch en 100% dynamisch aan op de productgroep uit LogicTrade (geen vaste optielijsten of hardcoded matrices).
          </p>
        </div>

        {/* Live Search Component */}
        <div className="w-full flex justify-center mb-8">
          <LiveProductSearch onSelectProduct={setSelectedProduct} />
        </div>

        {/* Geselecteerd Artikel Inspectie Kaart & Dynamisch Formulier */}
        {selectedProduct ? (
          <div className="w-full max-w-3xl flex flex-col gap-6">
            {/* Artikel Header Kaart */}
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md">
                    {selectedProduct.code}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">{selectedProduct.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Leverancier: <strong className="text-slate-200">{selectedProduct.supplierName}</strong> {selectedProduct.supplierId ? `(ID: ${selectedProduct.supplierId})` : ''}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block text-xs font-semibold px-3 py-1 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
                    {selectedProduct.salesGroup}
                  </span>
                </div>
              </div>

              {/* Technische Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Eenheid</span>
                  <span className="text-slate-100 font-semibold text-sm">{selectedProduct.unit || 'stuks'}</span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">BTW-tarief</span>
                  <span className="text-slate-100 font-semibold text-sm">{selectedProduct.vatCode}</span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Basisprijs (ERP)</span>
                  <span className="text-slate-100 font-semibold text-sm">
                    {selectedProduct.salesPrice > 0 ? `€ ${selectedProduct.salesPrice.toFixed(2)}` : 'Maatwerk (€ 0,00)'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">ERP Product ID</span>
                  <span className="text-slate-100 font-mono font-semibold text-sm">{selectedProduct.id}</span>
                </div>
              </div>

              {selectedProduct.groups.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center space-x-2 text-xs text-slate-400">
                  <span className="text-slate-400 font-medium">Artikelhiërarchie:</span>
                  <span className="text-blue-300 font-medium">{selectedProduct.groups.join(' › ')}</span>
                </div>
              )}
            </div>

            {/* Dynamisch Invoervelden Formulier (Fase 2B) */}
            <DynamicConfiguratorForm
              product={selectedProduct}
              onChange={setConfigValues}
            />
          </div>
        ) : (
          <div className="w-full max-w-xl text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl text-slate-400">
            <svg className="w-12 h-12 mx-auto text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-medium">Geen artikel geselecteerd</p>
            <p className="text-xs text-slate-400 mt-1">
              Typ hierboven een zoekterm (bijv. <strong className="text-slate-300">luxa due</strong> of <strong className="text-slate-300">gordijn</strong>) om direct een artikel te selecteren en de specifieke velden te zien.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
