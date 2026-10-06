import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Woninginrichter 3D Scanner & Plattegrond Engine',
  description: 'Robuuste, deterministische plattegrond- en doorsnede-engine voor Nederlandse woningen en typologieën conform NEN 2580.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
