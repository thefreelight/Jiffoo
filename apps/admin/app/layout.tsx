import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminLayout } from '../components/layout/admin-layout'
import { QueryProvider } from '../lib/providers/query-provider'
import { Toaster } from 'sonner'

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
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <AdminLayout>{children}</AdminLayout>
          <Toaster position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  )
}
