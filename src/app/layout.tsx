import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, DM_Sans } from 'next/font/google';
import './globals.css';
import { ConnectivityBanner, ConnectivityProvider } from '@/components/providers/ConnectivityProvider';

const displayFont = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
});

const bodyFont = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'POS PRO',
  description: 'POS PRO - Sistem kasir modern yang terhubung langsung ke server',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS PRO',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import AntdRegistry from '@/lib/AntdRegistry';
import { App } from 'antd';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        <AntdRegistry>
          <ThemeProvider>
            <App>
              <ConnectivityProvider>
                <NotificationProvider>
                  {children}
                </NotificationProvider>
                <ConnectivityBanner />
              </ConnectivityProvider>
            </App>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
