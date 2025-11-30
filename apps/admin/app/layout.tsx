import type { Metadata } from "next";
import "./globals.css";
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: "Jiffoo Mall - Super Admin Dashboard",
  description: "Jiffoo Multi-Tenant Platform Management System - Super Admin Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <I18nProvider defaultLanguage="zh-CN">
          <AuthGuard>
            <SuperAdminLayout>{children}</SuperAdminLayout>
          </AuthGuard>
          <Toaster position="top-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
