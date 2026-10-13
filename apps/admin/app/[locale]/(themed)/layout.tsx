import { AdminShell } from '@/components/layout/admin-shell';
import { adminThemeStyle } from '@/lib/theme-font';
import { getAdminTheme, getAdminStoreName, getAdminStoreUrl } from '@/lib/server-theme';

export default async function ThemedLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [theme, storeName] = await Promise.all([getAdminTheme('en'), getAdminStoreName()]);
  const storeUrl = getAdminStoreUrl(locale);
  return <>
    {theme && <style precedence="theme" dangerouslySetInnerHTML={{ __html: adminThemeStyle(theme) }} />}
    <AdminShell storeName={storeName} storeUrl={storeUrl} logo={theme?.logo ?? null} loginBackground={theme?.loginBackground ?? null}>
      {children}
    </AdminShell>
  </>;
}
