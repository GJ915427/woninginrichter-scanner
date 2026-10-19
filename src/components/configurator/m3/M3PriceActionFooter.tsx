import React from 'react';

export interface PriceFooterProps {
  basePriceEur: number;
  surchargeEur: number;
  proposalId?: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  validationMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onSubmit: () => void | Promise<void>;
  technicalSummary?: string;
}

export const M3PriceActionFooter: React.FC<PriceFooterProps> = ({
  basePriceEur,
  surchargeEur,
  proposalId = 'O26000735',
  disabled = false,
  isSubmitting = false,
  validationMessage,
  successMessage,
  errorMessage,
  onSubmit,
  technicalSummary
}) => {
  const totalEur = Math.max(0, basePriceEur + surchargeEur);

  const formatEur = (eur: number) => {
    return '€ ' + eur.toFixed(2).replace('.', ',');
  };

  return (
    <footer className="w-full bg-slate-950/95 border-t border-slate-800 backdrop-blur-md sticky bottom-0 z-40 p-4 sm:px-8 shadow-2xl transition-all">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Prijsopbouw & Samenvatting */}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400">
              <span>Basis: {formatEur(basePriceEur)}</span>
              {surchargeEur > 0 && (
                <span className="text-blue-400 font-medium">+{formatEur(surchargeEur)} toeslag</span>
              )}
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {formatEur(totalEur)}
              <span className="text-xs font-normal text-slate-400 ml-1.5">(incl. BTW)</span>
            </div>
          </div>

          {technicalSummary && (
            <div className="hidden md:inline-block text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full font-mono">
              {technicalSummary}
            </div>
          )}
        </div>

        {/* Notificaties / Validatie Status */}
        <div className="flex flex-col items-center sm:items-end gap-1.5">
          {successMessage && (
            <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 rounded-full flex items-center gap-1.5 animate-fadeIn">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="text-xs font-semibold text-rose-400 bg-rose-950/80 border border-rose-800/80 px-3 py-1 rounded-full">
              {errorMessage}
            </div>
          )}

          {disabled && validationMessage && !errorMessage && !successMessage && (
            <div className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 px-2.5 py-0.5 rounded-full font-medium">
              {validationMessage}
            </div>
          )}

          {/* Actieknop */}
          <button
            type="button"
            disabled={disabled || isSubmitting}
            onClick={onSubmit}
            className={`
              relative px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2
              ${disabled || isSubmitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 hover:shadow-blue-800/50 active:scale-95 cursor-pointer'}
            `}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Bezig met toevoegen...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Toevoegen aan Offerte {proposalId}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
};
