import React from 'react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 border-transparent shadow-xs',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border-transparent',
  outline: 'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-300 shadow-2xs',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-transparent shadow-xs',
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'outline',
  size = 'md',
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-control border transition-colors select-none min-h-[44px] px-3.5 text-xs gap-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant] || variantStyles.outline} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default ActionButton;
