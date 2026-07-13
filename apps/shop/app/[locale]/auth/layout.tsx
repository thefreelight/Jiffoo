/**
 * Auth Layout for Shop Application
 *
 * Theme-provided auth pages already render their own branded shell, so this
 * layout intentionally stays neutral and avoids adding host branding/chrome.
 */

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  await params;

  return <div className="min-h-screen">{children}</div>;
}
