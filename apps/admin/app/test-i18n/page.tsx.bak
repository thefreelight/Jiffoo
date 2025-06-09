'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { LanguageSwitcher } from '../../components/ui/language-switcher';
import { useI18n, formatDate, formatNumber, formatCurrency } from '../../lib/i18n';

export default function TestI18nPage() {
  const { t, language } = useI18n();

  const testData = {
    date: new Date(),
    number: 1234567.89,
    currency: 9999.99,
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('test.title', 'Internationalization Test')}
          </h1>
          <p className="text-muted-foreground">
            {t('test.description', 'Test page for multi-language functionality')}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* 当前语言信息 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.current_language', 'Current Language')}</CardTitle>
          <CardDescription>
            {t('test.current_language_desc', 'Information about the currently selected language')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('test.language_code', 'Language Code')}
              </label>
              <p className="text-lg font-mono">{language}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {t('test.language_name', 'Language Name')}
              </label>
              <p className="text-lg">{t('nav.dashboard', 'Dashboard')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 导航翻译测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.navigation', 'Navigation Translations')}</CardTitle>
          <CardDescription>
            {t('test.navigation_desc', 'Test navigation menu translations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              'nav.dashboard',
              'nav.products', 
              'nav.orders',
              'nav.customers',
              'nav.analytics',
              'nav.marketing',
              'nav.plugins',
              'nav.settings'
            ].map((key) => (
              <Badge key={key} variant="outline" className="justify-center py-2">
                {t(key, key.split('.')[1])}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 通用翻译测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.common_actions', 'Common Actions')}</CardTitle>
          <CardDescription>
            {t('test.common_actions_desc', 'Test common action button translations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="default">{t('common.save', 'Save')}</Button>
            <Button variant="outline">{t('common.cancel', 'Cancel')}</Button>
            <Button variant="destructive">{t('common.delete', 'Delete')}</Button>
            <Button variant="secondary">{t('common.edit', 'Edit')}</Button>
            <Button variant="ghost">{t('common.add', 'Add')}</Button>
            <Button variant="link">{t('common.refresh', 'Refresh')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* 格式化测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.formatting', 'Localization Formatting')}</CardTitle>
          <CardDescription>
            {t('test.formatting_desc', 'Test date, number, and currency formatting')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('test.date_format', 'Date Format')}
                </label>
                <p className="text-lg font-mono bg-muted p-2 rounded">
                  {formatDate(testData.date, language)}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('test.number_format', 'Number Format')}
                </label>
                <p className="text-lg font-mono bg-muted p-2 rounded">
                  {formatNumber(testData.number, language)}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('test.currency_format', 'Currency Format')}
                </label>
                <p className="text-lg font-mono bg-muted p-2 rounded">
                  {formatCurrency(testData.currency, 'CNY', language)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 插值测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.interpolation', 'String Interpolation')}</CardTitle>
          <CardDescription>
            {t('test.interpolation_desc', 'Test string interpolation with variables')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-lg">
              {t('test.welcome_message', 'Welcome back, {{username}}!', { username: 'Admin' })}
            </p>
            <p className="text-lg">
              {t('test.item_count', 'You have {{count}} items in your cart.', { count: '5' })}
            </p>
            <p className="text-lg">
              {t('test.last_login', 'Last login: {{date}}', { 
                date: formatDate(new Date(Date.now() - 86400000), language) 
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 语言切换器样式测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.switcher_styles', 'Language Switcher Styles')}</CardTitle>
          <CardDescription>
            {t('test.switcher_styles_desc', 'Different language switcher component styles')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium min-w-[100px]">Default:</label>
              <LanguageSwitcher variant="default" />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium min-w-[100px]">Compact:</label>
              <LanguageSwitcher variant="compact" />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium min-w-[100px]">Icon Only:</label>
              <LanguageSwitcher variant="icon-only" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 状态测试 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('test.status_messages', 'Status Messages')}</CardTitle>
          <CardDescription>
            {t('test.status_messages_desc', 'Test different status message translations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Badge variant="default">{t('common.success', 'Success')}</Badge>
            <Badge variant="destructive">{t('common.error', 'Error')}</Badge>
            <Badge variant="secondary">{t('common.warning', 'Warning')}</Badge>
            <Badge variant="outline">{t('common.info', 'Info')}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
