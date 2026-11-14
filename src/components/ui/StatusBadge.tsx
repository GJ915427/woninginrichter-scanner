import React from 'react';

export interface StatusBadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  dot?: boolean;
  className?: string;
  id?: string;
}

const toneStyles: Record<string, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
  neutral: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800', dot: 'bg-slate-400' },
  danger: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  dot = false,
  className = '',
  id,
}) => {
  const current = toneStyles[tone] || toneStyles.neutral;
  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-control text-xs font-medium border leading-none ${current.bg} ${current.text} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />}
      {label}
    </span>
  );
};

export default StatusBadge;
