import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { PwaRuntime } from '@/components/pwa-runtime';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'ServeOne',
  description: 'Единая платформа для служения: команда, задачи, коммуникация и организация в одном пространстве.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ServeOne'
  }
};

export const viewport: Viewport = {
  themeColor: '#18304f'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={manrope.variable}>
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
