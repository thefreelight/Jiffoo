import { getAdminTheme } from '@/lib/server-theme';
import { adminThemeStyle } from '@/lib/theme-font';

export default async function InstallLayout({ children }: { children: React.ReactNode }) {
  const theme = await getAdminTheme('en');
  return <>{theme && <style precedence="theme" dangerouslySetInnerHTML={{ __html: adminThemeStyle(theme) }} />}{children}</>;
}
