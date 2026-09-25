import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'pgcloud: the developer cloud for Türkiye, built for people and AI agents',
  description: 'Get a server in 60 seconds. Hourly billing in dollars or lira with e-Fatura, data that stays in Türkiye, one click apps, and API tokens your AI agents can use safely.',
  openGraph: { title: 'pgcloud', description: 'The developer cloud for Türkiye, built for people and AI agents.', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
