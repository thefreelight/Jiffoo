import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminLayout } from '../components/layout/admin-layout'
import { QueryProvider } from '../lib/providers/query-provider'
import { Toaster } from 'sonner'
import { ToastProvider } from '../components/ui/toast'
import { I18nProvider } from '../lib/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jiffoo Admin - Management Dashboard',
  description: 'Modern admin dashboard for Jiffoo e-commerce platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <ToastProvider>
          <QueryProvider>
            <I18nProvider>
              <AdminLayout>{children}</AdminLayout>
              <Toaster position="top-right" richColors />
            </I18nProvider>
          </QueryProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
