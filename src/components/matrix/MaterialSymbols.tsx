import React from 'react';

export interface MaterialSymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Google Material Symbols Outlined: square_foot (Geodriehoek / Drafting Set Square)
 * Karakteristiek Stitch procesicoon voor Inmeten met centrale driehoekige uitsparing en maataanduidingen.
 */
export function IconSquareFoot({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M17.66 17.66l-1.06 1.06-1.41-1.41 1.06-1.06-1.06-1.06-1.06 1.06-1.41-1.41 1.06-1.06-1.06-1.06-1.06 1.06-1.41-1.41 1.06-1.06-1.06-1.06-1.06 1.06-1.41-1.41 1.06-1.06L4 4v16h16l-2.34-2.34zM6 18v-8.83l8.83 8.83H6z" />
    </svg>
  );
}

/**
 * Google Material Symbols Outlined: calendar_month (Maak Afspraak)
 */
export function IconCalendarMonth({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-8 4h2v2h-2zm-4 0h2v2H7zm8 0h2v2h-2zm-4 4h2v2h-2zm-4 0h2v2H7zm8 0h2v2h-2z" />
    </svg>
  );
}

/**
 * Google Material Symbols Outlined: description (Maak Rapport)
 */
export function IconDescription({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

/**
 * Google Material Symbols Outlined: build (Monteren)
 */
export function IconBuild({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  );
}

/**
 * Google Material Symbols Outlined: lock (Afronden)
 */
export function IconLock({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

/**
 * Google Material Symbols Outlined: attach_file (Bijlagen)
 */
export function IconAttachFile({ size = 16, className = '', ...props }: MaterialSymbolProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
    </svg>
  );
}
