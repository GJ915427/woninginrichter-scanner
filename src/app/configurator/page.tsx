'use client';

import React, { useState, useTransition } from 'react';
import { M3SearchBox } from '@/components/configurator/m3/M3SearchBox';
import { DynamicConfiguratorForm } from '@/components/configurator/DynamicConfiguratorForm';
import { M3PriceActionFooter } from '@/components/configurator/m3/M3PriceActionFooter';
import { SearchResultItem } from '@/types/product';
import { ProductConfigValues, StepChangeIntent } from '@/types/configurator';
import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import { Configuration } from '@/domain/configurator/bron-a-contracts';
import { CreateProposalLineResponse } from '@/app/api/proposals/[id]/lines/route';

export default function ConfiguratorPage() {
  const [selectedProduct, setSelectedProduct] = useState<SearchResultItem | null>(null);
  const [configValues, setConfigValues] = useState<ProductConfigValues>({});
  const [rulesEngine, setRulesEngine] = useState<ConclaafRulesEngine | null>(null);
  const [snapshot, setSnapshot] = useState<Configuration | null>(null);
  const [totalSurchargeEur, setTotalSurchargeEur] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const proposalId = 'O26000735';

  const handleSelectProduct = (product: SearchResultItem | null) => {
    setSelectedProduct(product);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (product) {
      const engine = new ConclaafRulesEngine(product);
      if (product.preconfiguration) {
        const preconf = { ...product.preconfiguration };

        // 1. Normaliseer VORM en BEDIENINGS_TYPE uit modelPreset indien aanwezig
        if (product.modelPreset?.vorm) {
          const rawVorm = product.modelPreset.vorm;
          preconf.VORM = rawVorm.startsWith(':20') ? ':20' : rawVorm.startsWith(':30') ? ':30' : ':10';
        }
        if (product.modelPreset?.bediening) {
          preconf.BEDIENINGS_TYPE = product.modelPreset.bediening.toUpperCase().replace(/\s+/g, '');
        }

        // 2. Pas configuratiestappen topologisch toe (Parent steps vóór conditional sub-steps)
        const stepOrder = [
          'VORM',
          'BEDIENINGS_TYPE',
          'MONTAGE',
          'PROFIELKLEUR',
          'VOEDINGSTYPE',
          'VOEDINGSZIJDE',
          'BEDIENINGSZIJDE',
          'STOF_KLEUR',
          'PLOOISOORT',
          'LOODVETER',
          'OPENING',
          'SNIJVERLIES',
          'LEGWYZE',
          'PLINTEN'
        ];

        for (const step of stepOrder) {
          if (preconf[step] && typeof preconf[step] === 'string') {
            engine.updateStep(step, preconf[step]);
          }
        }

        for (const [stepId, value] of Object.entries(preconf)) {
          if (
            !stepOrder.includes(stepId) &&
            !['modelPreset', 'montage', 'bediening', 'stofFilter', 'eigenschap'].includes(stepId) &&
            typeof value === 'string'
          ) {
            engine.updateStep(stepId, value);
          }
        }
      }
      setRulesEngine(engine);
      const initialSnapshot = engine.getConfiguration();
      setSnapshot(initialSnapshot);
      const surcharge = engine.calculateTotalSurcharge();
      setTotalSurchargeEur(surcharge.totalSurchargeEur);

      const initialVals: ProductConfigValues = {};
      for (const step of initialSnapshot.steps) {
        if (step.selectedValue?.value) {
          initialVals[step.id] = step.selectedValue.value;
        } else if (step.value) {
          initialVals[step.id] = step.value;
        }
      }
      setConfigValues(initialVals);
    } else {
      setRulesEngine(null);
      setSnapshot(null);
      setTotalSurchargeEur(0);
      setConfigValues({});
    }
  };

  const handleStepChange = (intent: StepChangeIntent) => {
    if (!rulesEngine) return;
    startTransition(() => {
      const updatedSnapshot = rulesEngine.updateStep(intent.stepId, intent.value);
      setSnapshot(updatedSnapshot);
      const surcharge = rulesEngine.calculateTotalSurcharge();
      setTotalSurchargeEur(surcharge.totalSurchargeEur);
    });
  };

  const handleConfigChange = (values: ProductConfigValues) => {
    setConfigValues(values);
  };

  const handleAddToProposal = async () => {
    if (!selectedProduct || !snapshot || snapshot.errors.length > 0) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/proposals/${proposalId}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: String(selectedProduct.id),
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          configuration: snapshot,
          totalPriceEur: Math.max(0, (selectedProduct.salesPrice || 0) + surchargeEur),
          notes: 'Geconfigureerd via EasyM2M M3 Configurator'
        })
      });

      const data: CreateProposalLineResponse = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message || `Succesvol toegevoegd aan regel ${data.lineNumber} van offerte ${proposalId}`);
      } else {
        setErrorMessage(data.error || 'Er is een fout opgetreden bij het toevoegen aan de offerte');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Netwerkfout bij inschieten van orderregel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const surchargeEur = totalSurchargeEur;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans selection:bg-emerald-500/20">
      {/* Material Design 3 Top App Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                Product Configurator
              </h1>
              <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                EasyM2M
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Material Design 3 Domein-gestuurde Artikelconfiguratie (Bron A SSOT)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-full shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>LogicTrade Cloud REST API</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 flex flex-col items-center">
        {/* Dedicated 1-Regelige M3 Zoekbox */}
        <div className="w-full max-w-2xl mb-8">
          <M3SearchBox
            onSelectProduct={handleSelectProduct}
            initialProduct={selectedProduct}
            placeholder="Typ een artikelcode, omschrijving of merk (bijv. Luxaflex, Vadain, A00052469)..."
          />
        </div>

        {/* Dynamisch Formulier of M3 Empty State Begeleiding */}
        {selectedProduct ? (
          <div className="w-full max-w-2xl">
            <DynamicConfiguratorForm
              product={selectedProduct}
              snapshot={snapshot ? {
                configuration: snapshot,
                totalSurchargeEur,
                calculationErrors: snapshot.errors.map(e => e.message)
              } : undefined}
              onStepChange={handleStepChange}
              onChange={handleConfigChange}
            />
          </div>
        ) : (
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-sm dark:shadow-xl transition-all">
            <div className="text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Welkom bij de Product Configurator
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Typ in de zoekbalk hierboven om direct een maatwerkartikel te selecteren. De configurator past zich automatisch aan op de productgroep.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 text-left">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Stap 1</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Zoek artikel of merk</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Stap 2</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Configureer maten & opties</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Stap 3</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Toevoegen aan offerte</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* M3 Sticky Price & Action Footer */}
      {selectedProduct && (
        <M3PriceActionFooter
          basePriceEur={selectedProduct.salesPrice || 0}
          surchargeEur={totalSurchargeEur}
          disabled={!snapshot || snapshot.errors.length > 0}
          isSubmitting={isSubmitting}
          onSubmit={handleAddToProposal}
          proposalId={proposalId}
          validationMessage={snapshot && snapshot.errors.length > 0 ? snapshot.errors[0].message : undefined}
          successMessage={successMessage || undefined}
          errorMessage={errorMessage || undefined}
        />
      )}
    </div>
  );
}
