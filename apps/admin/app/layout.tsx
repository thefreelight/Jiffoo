import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminLayout } from '../components/layout/admin-layout'

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
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  )
}
