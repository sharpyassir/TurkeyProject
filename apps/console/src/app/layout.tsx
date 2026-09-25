import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';

export const metadata: Metadata = {
  title: 'pgcloud console',
  description: 'The developer cloud for Türkiye',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
