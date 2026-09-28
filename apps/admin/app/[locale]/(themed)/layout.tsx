import { BlueMinimalLayout } from '@/components/layout/blue-minimal-layout';
import { adminThemeStyle } from '@/lib/theme-font';
import { getAdminTheme } from '@/lib/server-theme';

export default async function ThemedLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const theme = await getAdminTheme(locale);
  return <>
    {theme && <style precedence="theme" dangerouslySetInnerHTML={{ __html: adminThemeStyle(theme) }} />}
    <BlueMinimalLayout logo={theme?.logo ?? null} loginBackground={theme?.loginBackground ?? null}>
      {children}
    </BlueMinimalLayout>
  </>;
}
