import type { Metadata, Viewport } from 'next';
import { Baloo_2, Poppins } from 'next/font/google';
import { PhoneShell } from '@/components/PhoneShell';
import './globals.css';

const display = Baloo_2({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

const ui = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-ui',
});

export const metadata: Metadata = {
  title: 'Yogurtland Daily Word',
  description: 'Guess the five-letter word in six tries and win a Yogurtland treat.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1B0310',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <PhoneShell>{children}</PhoneShell>
      </body>
    </html>
  );
}
