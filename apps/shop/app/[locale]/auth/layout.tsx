/**
 * Auth Layout for Shop Application
 *
 * Provides a consistent layout for authentication pages.
 * Supports i18n by preserving locale in navigation.
 */

import Link from 'next/link';

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href={`/${locale}`} className="inline-flex items-center space-x-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">J</span>
            </div>
            <span className="font-bold text-2xl text-gradient">Jiffoo</span>
          </Link>
        </div>

        {/* Auth Content */}
        <div className="max-w-md mx-auto">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>© 2024 Jiffoo Mall. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
