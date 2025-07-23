'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';
import { LanguageSelector, LanguageSwitcher } from '../../../components/ui/language-switcher';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../../lib/i18n';
import { Globe, Check, Settings, Users, Palette } from 'lucide-react';
import { toast } from 'sonner';

export default function LanguageSettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [fallbackLanguage, setFallbackLanguage] = useState<SupportedLanguage>('en-US');
  const [enabledLanguages, setEnabledLanguages] = useState<SupportedLanguage[]>([
    'zh-CN', 'en-US', 'ja-JP'
  ]);

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    setIsLoading(true);
    try {
      await setLanguage(newLanguage);
      toast.success(t('settings.language_changed', 'Language changed successfully'));
    } catch (error) {
      toast.error(t('common.error', 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLanguage = (langCode: SupportedLanguage) => {
    if (langCode === language) {
      toast.warning(t('settings.cannot_disable_current', 'Cannot disable current language'));
      return;
    }

    setEnabledLanguages(prev => 
      prev.includes(langCode)
        ? prev.filter(code => code !== langCode)
        : [...prev, langCode]
    );
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // 这里可以调用API保存设置
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
      toast.success(t('settings.saved', 'Settings saved successfully'));
    } catch (error) {
      toast.error(t('common.error', 'Failed to save settings'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.language', 'Language Settings')}</h1>
        <p className="text-muted-foreground">
          {t('settings.language_description', 'Configure language preferences for the admin interface')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 当前语言设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('settings.current_language', 'Current Language')}
            </CardTitle>
            <CardDescription>
              {t('settings.current_language_desc', 'Select your preferred language for the admin interface')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
            />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-detect">
                  {t('settings.auto_detect', 'Auto-detect language')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.auto_detect_desc', 'Automatically detect language from browser settings')}
                </p>
              </div>
              <Switch
                id="auto-detect"
                checked={autoDetect}
                onCheckedChange={setAutoDetect}
              />
            </div>
          </CardContent>
        </Card>

        {/* 语言切换器预览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('settings.switcher_preview', 'Language Switcher Preview')}
            </CardTitle>
            <CardDescription>
              {t('settings.switcher_preview_desc', 'Preview different language switcher styles')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Default Style</Label>
                <div className="mt-2">
                  <LanguageSwitcher variant="default" />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Compact Style</Label>
                <div className="mt-2">
                  <LanguageSwitcher variant="compact" />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Icon Only</Label>
                <div className="mt-2">
                  <LanguageSwitcher variant="icon-only" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 可用语言管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('settings.available_languages', 'Available Languages')}
          </CardTitle>
          <CardDescription>
            {t('settings.available_languages_desc', 'Enable or disable languages for your admin interface')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isEnabled = enabledLanguages.includes(lang.code);
              const isCurrent = language === lang.code;
              
              return (
                <div
                  key={lang.code}
                  className={`relative flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                    isCurrent
                      ? 'border-primary bg-primary/5'
                      : isEnabled
                      ? 'border-border bg-background hover:bg-muted/50'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {lang.name}
                      </p>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          {t('settings.current', 'Current')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lang.nativeName}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {isCurrent ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggleLanguage(lang.code)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 高级设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('settings.advanced', 'Advanced Settings')}
          </CardTitle>
          <CardDescription>
            {t('settings.advanced_desc', 'Configure advanced language and localization options')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              {t('settings.fallback_language', 'Fallback Language')}
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              {t('settings.fallback_desc', 'Language to use when translations are missing')}
            </p>
            <LanguageSelector
              value={fallbackLanguage}
              onChange={setFallbackLanguage}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>
                {t('settings.rtl_support', 'RTL Support')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.rtl_desc', 'Enable right-to-left text direction for supported languages')}
              </p>
            </div>
            <Switch defaultChecked={false} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>
                {t('settings.date_localization', 'Date Localization')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.date_desc', 'Format dates according to selected language')}
              </p>
            </div>
            <Switch defaultChecked={true} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>
                {t('settings.number_localization', 'Number Localization')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.number_desc', 'Format numbers and currency according to selected language')}
              </p>
            </div>
            <Switch defaultChecked={true} />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings} 
          disabled={isLoading}
          className="min-w-[120px]"
        >
          {isLoading ? t('common.loading', 'Loading...') : t('common.save', 'Save Settings')}
        </Button>
      </div>
    </div>
  );
}
