import React from 'react';

export interface MicroLabelProps {
  label: string;
  value?: React.ReactNode;
  className?: string;
}

export const MicroLabel: React.FC<MicroLabelProps> = ({
  label,
  value,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 leading-none select-none">
        {label.toUpperCase()}
      </span>
      {value !== undefined && value !== null && (
        <span className="text-xs font-medium text-slate-900 leading-snug">
          {value}
        </span>
      )}
    </div>
  );
};

export default MicroLabel;
