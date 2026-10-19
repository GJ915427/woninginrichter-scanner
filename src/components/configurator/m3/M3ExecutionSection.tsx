import React from 'react';
import { ConfigurationStep } from '@/domain/configurator/bron-a-contracts';
import { ProductCategory } from '@/types/configurator';

export interface M3ExecutionSectionProps {
  steps: ConfigurationStep[];
  category: ProductCategory;
  onChangeStep: (stepId: string, value: string) => void;
}

export const M3ExecutionSection: React.FC<M3ExecutionSectionProps> = ({
  steps,
  category,
  onChangeStep
}) => {
  // Sluit stappen uit die al in M3DimensionSection worden gerenderd
  const visibleExecutionSteps = steps.filter(
    (step) =>
      step.show &&
      step.id !== 'BREEDTE' &&
      step.id !== 'HOOGTE' &&
      step.id !== 'MAATVOERING'
  );

  if (visibleExecutionSteps.length === 0) {
    return null;
  }

  const sectionTitle = category === 'gordijnen' ? 'Confectie & Afwerking' : 'Uitvoering & Opties';

  return (
    <section className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm transition-all duration-200">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-800/80">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/30">
          2
        </span>
        <h4 className="text-base font-semibold text-white tracking-wide">
          {sectionTitle}
        </h4>
      </div>

      {/* Grid van optiestappen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleExecutionSteps.map((step) => {
          const isFabric = step.id === 'STOF_KLEUR';

          return (
            <div
              key={step.id}
              className={`${isFabric ? 'sm:col-span-2' : ''} space-y-1.5`}
            >
              <label
                htmlFor={`step-${step.id}`}
                className="block text-xs font-medium text-slate-300"
              >
                {step.description}
                {step.required && <span className="text-blue-400 ml-1">*</span>}
              </label>

              <div className="relative">
                <select
                  id={`step-${step.id}`}
                  name={step.id}
                  value={step.value || ''}
                  disabled={!step.enabled}
                  onChange={(e) => onChangeStep(step.id, e.target.value)}
                  className="w-full appearance-none rounded-xl bg-slate-950/80 px-3.5 py-2.5 text-sm font-medium text-white border border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors pr-10"
                >
                  {step.possibleValues?.map((pv) => {
                    if (pv.show === false) return null;

                    const surchargeText =
                      pv.chargeAmount && pv.chargeAmount > 0
                        ? ` (+ € ${pv.chargeAmount.toFixed(2)})`
                        : '';

                    return (
                      <option key={pv.key} value={pv.key} className="bg-slate-900 text-white">
                        {pv.value}
                        {surchargeText}
                      </option>
                    );
                  })}
                </select>

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Stofstaal preview badge voor STOF_KLEUR */}
              {isFabric && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <span className="inline-block w-3.5 h-3.5 rounded-full bg-amber-100 border border-slate-600 shadow-inner"></span>
                  <span>Geselecteerde kleurstaal uit officiële Hunter Douglas collectie</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
