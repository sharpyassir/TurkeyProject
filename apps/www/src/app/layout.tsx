import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'pgcloud — The developer cloud for Türkiye, built for humans and AI agents',
  description: 'Servers in Istanbul in 60 seconds. Hourly billing in TRY or USD, e-Fatura, KVKK residency, one-click apps, and API tokens your AI agents can safely use.',
  openGraph: { title: 'pgcloud', description: 'The developer cloud for Türkiye, built for humans and AI agents.', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
