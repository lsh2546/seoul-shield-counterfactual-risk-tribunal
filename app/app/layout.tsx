import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './terminal-remaster.css';
import './cinematic-remaster.css';
import './market-cockpit.css';
import './verified-market-only.css';
import './digital-twin.css';
import './autonomous-bright.css';
import './ai-decision-core.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Seoul Shield — Counterfactual Risk Tribunal',
  description: 'One option signal enters four policy universes. Only one can earn the right to trade.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
