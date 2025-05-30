import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Jiffoo Admin - Management Dashboard',
    template: '%s | Jiffoo Admin',
  },
  description: 'Comprehensive admin dashboard for Jiffoo e-commerce platform management.',
  keywords: ['admin', 'dashboard', 'e-commerce', 'management', 'jiffoo'],
  authors: [{ name: 'Jiffoo Team' }],
  creator: 'Jiffoo Team',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#3b82f6',
                borderRadius: 8,
                fontFamily: 'Inter, system-ui, sans-serif',
              },
              components: {
                Layout: {
                  headerBg: '#ffffff',
                  siderBg: '#ffffff',
                  bodyBg: '#f8fafc',
                },
                Menu: {
                  itemBg: 'transparent',
                  itemSelectedBg: '#eff6ff',
                  itemSelectedColor: '#3b82f6',
                  itemHoverBg: '#f1f5f9',
                },
              },
            }}
          >
            <Providers>
              {children}
            </Providers>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
