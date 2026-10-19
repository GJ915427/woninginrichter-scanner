import React, { useState, useMemo } from 'react';
import { SearchResultItem } from '@/types/product';
import {
  ProductConfigValues,
  ProductCategory,
  ConfigurationSnapshot,
  StepChangeIntent
} from '@/types/configurator';
import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import { Configuration } from '@/domain/configurator/bron-a-contracts';
import { M3DimensionSection } from './m3/M3DimensionSection';
import { M3ExecutionSection } from './m3/M3ExecutionSection';

export interface DynamicConfiguratorFormProps {
  product: SearchResultItem;
  snapshot?: ConfigurationSnapshot;
  onStepChange?: (intent: StepChangeIntent) => void;
  onChange?: (values: ProductConfigValues) => void;
}

export const DynamicConfiguratorForm: React.FC<DynamicConfiguratorFormProps> = ({
  product,
  snapshot,
  onStepChange,
  onChange
}) => {
  // Stateless fallback engine alleen wanneer snapshot niet extern meegeleverd is (tests)
  const fallbackEngine = useMemo(() => {
    if (snapshot) return null;
    const e = new ConclaafRulesEngine(product);
    if (product?.preconfiguration) {
      for (const [stepId, val] of Object.entries(product.preconfiguration)) {
        if (stepId !== 'modelPreset' && typeof val === 'string') {
          e.updateStep(stepId, val);
        }
      }
    }
    return e;
  }, [product, snapshot]);

  const [localFallbackConfig, setLocalFallbackConfig] = useState<Configuration | null>(() =>
    fallbackEngine ? fallbackEngine.getImmutableSnapshot() : null
  );

  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(false);

  // Configuration SSOT: óf vanuit snapshot (Thin Client), óf vanuit local fallback
  const config = snapshot
    ? snapshot.configuration
    : (localFallbackConfig || fallbackEngine?.getConfiguration());
  const category: ProductCategory = fallbackEngine?.getCategory() || (product.salesGroup?.toLowerCase() as ProductCategory) || 'raamdecoratie';

  if (!config) {
    return null;
  }

  // Blijvende maat bepalen uit de configuratie
  const isBlijvendeMaat = config.steps.find((s) => s.id === 'MAATVOERING')?.value !== 'MAAKMAAT';

  // Handler voor stappen
  const handleStepChange = (stepId: string, value: string) => {
    if (onStepChange) {
      onStepChange({ stepId, value });
    } else if (fallbackEngine) {
      const updated = fallbackEngine.updateStep(stepId, value);
      setLocalFallbackConfig(updated);
    }

    if (onChange) {
      const values: ProductConfigValues = {
        productId: String(product.id),
        productCode: product.code,
        productName: product.name,
        category
      };
      config.steps.forEach((step) => {
        if (step.value) values[step.id] = step.value;
      });
      values[stepId] = value;
      onChange(values);
    }
  };

  const handleToggleBlijvendeMaat = (val: boolean) => {
    handleStepChange('MAATVOERING', val ? 'BLIJVENDE_MAAT' : 'MAAKMAAT');
  };

  const widthStep = config.steps.find((s) => s.id === 'BREEDTE');
  const heightStep = config.steps.find((s) => s.id === 'HOOGTE');

  const basePriceEur = product.salesPrice || 0;
  const totalSurchargeEur = snapshot
    ? snapshot.totalSurchargeEur
    : (fallbackEngine?.calculateTotalSurcharge().totalSurchargeEur || 0);
  const finalPriceEur = basePriceEur + totalSurchargeEur;

  const formatEur = (val: number) =>
    val.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full flex flex-col gap-5">
      {/* 1. Compacte Artikel Header Badge (Single Occurrence: 1x op het scherm) */}
      <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {product.code}
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {product.name}
            </h3>
            <p className="text-xs text-slate-400">
              Leverancier: <strong className="text-slate-200">{product.supplierName}</strong>
            </p>
          </div>
        </div>

        <span className="self-start sm:self-center text-xs font-semibold px-3 py-1 bg-slate-900 text-slate-300 rounded-full border border-slate-700">
          {product.salesGroup}
        </span>
      </div>

      {/* Model Preset Banner (wanneer modelcode zoals AU20 is herkend) */}
      {product.modelPreset && (
        <div className="w-full bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Modelconfiguratie: {product.modelPreset.code}
            </span>
            <span className="text-sm font-semibold text-white">
              {product.modelPreset.name}
            </span>
          </div>
          {product.modelPreset.surchargeEur != null && (
            <span className="self-start sm:self-auto text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
              € {product.modelPreset.surchargeEur.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* 2. Maten Direct Bovenaan in mm met M3 Switch Blijvende maat */}
      {widthStep && heightStep && (
        <M3DimensionSection
          widthStep={widthStep}
          heightStep={heightStep}
          isBlijvendeMaat={isBlijvendeMaat}
          onToggleBlijvendeMaat={handleToggleBlijvendeMaat}
          onChangeWidth={(val) => handleStepChange('BREEDTE', val)}
          onChangeHeight={(val) => handleStepChange('HOOGTE', val)}
          errors={config.errors}
        />
      )}

      {/* 3. Uitvoering & Conditionele Opties (Vorm, Montage, Bediening/Motor, Stof, Confectie) */}
      <M3ExecutionSection
        steps={config.steps}
        category={category}
        onChangeStep={handleStepChange}
      />

      {/* 4. M3 Live Prijscalculatie Balk (Basis + Toeslagen = Totaal) */}
      <div className="w-full bg-slate-900/80 border border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 block mb-0.5">
            Realtime Prijsspecificatie (excl. btw)
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Basis: € {formatEur(basePriceEur)}</span>
            {totalSurchargeEur > 0 && (
              <>
                <span>+</span>
                <span className="text-amber-400 font-medium">
                  Opties: +€ {formatEur(totalSurchargeEur)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs text-slate-400 block">Totaalprijs</span>
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            € {formatEur(finalPriceEur)}
          </span>
        </div>
      </div>

      {/* 5. Samengevouwen Technische Artikelhiërarchie Accordion (Helemaal Onderaan) */}
      <div className="w-full bg-slate-950/40 border border-slate-800/60 rounded-2xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Technische artikeldetails &amp; ERP-hiërarchie
          </span>
          <svg
            className={`w-4 h-4 transform transition-transform duration-200 ${
              isAccordionOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isAccordionOpen && (
          <div className="p-5 border-t border-slate-800/60 bg-slate-900/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block mb-1">Eenheid</span>
              <span className="text-slate-200 font-semibold">{product.unit || 'stuks'}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block mb-1">BTW-tarief</span>
              <span className="text-slate-200 font-semibold">{product.vatCode || 'BTW Hoog'}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block mb-1">ERP Product ID</span>
              <span className="text-slate-200 font-mono font-semibold">{product.id}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block mb-1">Leverancier ID</span>
              <span className="text-slate-200 font-mono font-semibold">{product.supplierId || '–'}</span>
            </div>
            {product.groups && product.groups.length > 0 && (
              <div className="col-span-2 sm:col-span-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center gap-2">
                <span className="text-slate-500 font-medium">Artikelhiërarchie:</span>
                <span className="text-blue-300 font-medium">{product.groups.join(' – ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
