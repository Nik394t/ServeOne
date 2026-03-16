import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { PwaRuntime } from '@/components/pwa-runtime';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim()
  ? `/${process.env.NEXT_PUBLIC_BASE_PATH.trim().replace(/^\/+|\/+$/g, '')}`
  : '';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'ServeOne',
  description: 'Единая платформа для служения: команда, задачи, коммуникация и организация в одном пространстве.',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { url: `${basePath}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: `${basePath}/icons/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }]
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
