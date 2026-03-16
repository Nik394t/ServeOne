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
  description: 'Панель управления медиа-служением',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: ['/icons/icon-192.png', '/icons/icon-512.png'],
    apple: '/icons/icon-192.png'
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
