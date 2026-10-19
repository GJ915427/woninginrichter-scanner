import React from 'react';
import { ConfigurationStep, ConfigurationError } from '@/domain/configurator/bron-a-contracts';

export interface M3DimensionSectionProps {
  widthStep: ConfigurationStep;
  heightStep: ConfigurationStep;
  isBlijvendeMaat: boolean;
  onToggleBlijvendeMaat: (val: boolean) => void;
  onChangeWidth: (val: string) => void;
  onChangeHeight: (val: string) => void;
  errors: ConfigurationError[];
}

export const M3DimensionSection: React.FC<M3DimensionSectionProps> = ({
  widthStep,
  heightStep,
  isBlijvendeMaat,
  onToggleBlijvendeMaat,
  onChangeWidth,
  onChangeHeight,
  errors
}) => {
  const widthErrors = errors.filter(e => e.stepId === widthStep.id);
  const heightErrors = errors.filter(e => e.stepId === heightStep.id);

  const hasWidthError = widthErrors.length > 0;
  const hasHeightError = heightErrors.length > 0;

  return (
    <section className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm transition-all duration-200">
      {/* Header & M3 Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
        <div className="flex items-center space-x-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/30">
            1
          </span>
          <h4 className="text-base font-semibold text-white tracking-wide">
            Afmetingen &amp; Maatvoering
          </h4>
        </div>

        {/* M3 Toggle Switch: Blijvende maat vs Maakmaat */}
        <label className="inline-flex items-center cursor-pointer select-none group">
          <span className="text-xs font-medium text-slate-300 mr-3 group-hover:text-white transition-colors">
            {isBlijvendeMaat ? 'Blijvende maat' : 'Maakmaat'}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isBlijvendeMaat}
              onChange={(e) => onToggleBlijvendeMaat(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 border border-slate-700"></div>
          </div>
        </label>
      </div>

      {/* Switch helptekst */}
      <p className="text-xs text-slate-400 mb-4 italic">
        {isBlijvendeMaat
          ? 'Strakke dagmaat gemeten: de fabriek trekt automatisch de productietolerantie af.'
          : 'Maakmaat geselecteerd: het product wordt exact op deze maat geproduceerd.'}
      </p>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Breedte Input */}
        <div>
          <label htmlFor={`step-${widthStep.id}`} className="block text-xs font-medium text-slate-300 mb-1.5">
            {widthStep.description}
          </label>
          <div className="relative rounded-xl shadow-sm">
            <input
              id={`step-${widthStep.id}`}
              name={widthStep.id}
              type="text"
              inputMode="numeric"
              value={widthStep.value || ''}
              onChange={(e) => onChangeWidth(e.target.value)}
              className={`w-full rounded-xl bg-slate-950/80 px-3.5 py-2.5 text-sm font-semibold text-white border transition-colors focus:outline-none focus:ring-2 pr-12 ${
                hasWidthError
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-200'
                  : 'border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
              placeholder="Breedte in mm"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
              <span className="text-xs font-mono text-slate-500">
                {widthStep.suffix || 'mm'}
              </span>
            </div>
          </div>
          {widthStep.minValue && widthStep.maxValue && !hasWidthError && (
            <span className="text-[11px] text-slate-500 mt-1 block">
              Min: {widthStep.minValue} mm — Max: {widthStep.maxValue} mm
            </span>
          )}
          {hasWidthError && (
            <div className="mt-1.5 space-y-1">
              {widthErrors.map((err, i) => (
                <p key={i} className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{err.message}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Hoogte Input */}
        <div>
          <label htmlFor={`step-${heightStep.id}`} className="block text-xs font-medium text-slate-300 mb-1.5">
            {heightStep.description}
          </label>
          <div className="relative rounded-xl shadow-sm">
            <input
              id={`step-${heightStep.id}`}
              name={heightStep.id}
              type="text"
              inputMode="numeric"
              value={heightStep.value || ''}
              onChange={(e) => onChangeHeight(e.target.value)}
              className={`w-full rounded-xl bg-slate-950/80 px-3.5 py-2.5 text-sm font-semibold text-white border transition-colors focus:outline-none focus:ring-2 pr-12 ${
                hasHeightError
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-200'
                  : 'border-slate-800 hover:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
              placeholder="Hoogte in mm"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
              <span className="text-xs font-mono text-slate-500">
                {heightStep.suffix || 'mm'}
              </span>
            </div>
          </div>
          {heightStep.minValue && heightStep.maxValue && !hasHeightError && (
            <span className="text-[11px] text-slate-500 mt-1 block">
              Min: {heightStep.minValue} mm — Max: {heightStep.maxValue} mm
            </span>
          )}
          {hasHeightError && (
            <div className="mt-1.5 space-y-1">
              {heightErrors.map((err, i) => (
                <p key={i} className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{err.message}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
