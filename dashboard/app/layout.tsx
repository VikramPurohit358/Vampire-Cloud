import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vampire Cloud — Enterprise Distributed Compute Grid',
  description:
    'High-performance distributed compute engine and autonomous token grid. Monetize idle compute capacity or scale enterprise workloads.',
  keywords: ['distributed compute', 'cloud grid', 'enterprise computing', 'decentralized AI', 'compute engine'],
  openGraph: {
    title: 'Vampire Cloud — Enterprise Compute Grid',
    description: 'High-performance distributed compute engine and autonomous token grid.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-slate-900 text-slate-100">{children}</body>
    </html>
  );
}
