'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { Badge } from '../../../../components/ui/badge';
import { Separator } from '../../../../components/ui/separator';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../../../lib/i18n';
import { 
  getI18nConfig, 
  saveI18nConfig, 
  type I18nConfig,
  languageConfigs,
  calculateTranslationCoverage 
} from '../../../../lib/i18n-config';
import { 
  Settings, 
  Globe, 
  Zap, 
  Shield, 
  BarChart3, 
  Database,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdvancedLanguageSettingsPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<I18nConfig>(getI18nConfig());
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 模拟翻译覆盖率数据
  const [coverageData] = useState(() => 
    calculateTranslationCoverage({
      'nav.dashboard': { 'zh-CN': '仪表板', 'en-US': 'Dashboard', 'ja-JP': 'ダッシュボード', 'ko-KR': '대시보드', 'es-ES': '', 'fr-FR': '' },
      'common.save': { 'zh-CN': '保存', 'en-US': 'Save', 'ja-JP': '保存', 'ko-KR': '저장', 'es-ES': 'Guardar', 'fr-FR': 'Enregistrer' },
      // 更多翻译数据...
    }, SUPPORTED_LANGUAGES.map(l => l.code))
  );

  const updateConfig = (updates: Partial<I18nConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      saveI18nConfig(config);
      setHasChanges(false);
      toast.success(t('settings.saved', 'Settings saved successfully'));
    } catch (error) {
      toast.error(t('common.error', 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setConfig(getI18nConfig());
    setHasChanges(false);
    toast.info(t('settings.reset', 'Settings reset to default'));
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('settings.advanced_language', 'Advanced Language Settings')}
          </h1>
          <p className="text-muted-foreground">
            {t('settings.advanced_language_desc', 'Configure advanced internationalization options')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            {t('common.reset', 'Reset')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
            {isLoading ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      {/* 更改提示 */}
      {hasChanges && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('settings.unsaved_changes', 'You have unsaved changes')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.general', 'General')}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.performance', 'Performance')}</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.api', 'API')}</span>
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.quality', 'Quality')}</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.analytics', 'Analytics')}</span>
          </TabsTrigger>
        </TabsList>

        {/* 常规设置 */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settings.language_behavior', 'Language Behavior')}
              </CardTitle>
              <CardDescription>
                {t('settings.language_behavior_desc', 'Configure how the system handles language detection and switching')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>{t('settings.default_language', 'Default Language')}</Label>
                  <Select 
                    value={config.defaultLanguage} 
                    onValueChange={(value) => updateConfig({ defaultLanguage: value as SupportedLanguage })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('settings.fallback_language', 'Fallback Language')}</Label>
                  <Select 
                    value={config.fallbackLanguage} 
                    onValueChange={(value) => updateConfig({ fallbackLanguage: value as SupportedLanguage })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.auto_detect', 'Auto-detect Language')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.auto_detect_desc', 'Automatically detect user language from browser settings')}
                    </p>
                  </div>
                  <Switch
                    checked={config.autoDetectLanguage}
                    onCheckedChange={(checked) => updateConfig({ autoDetectLanguage: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.persist_choice', 'Persist Language Choice')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.persist_choice_desc', 'Remember user language selection across sessions')}
                    </p>
                  </div>
                  <Switch
                    checked={config.persistLanguageChoice}
                    onCheckedChange={(checked) => updateConfig({ persistLanguageChoice: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.enable_rtl', 'Enable RTL Support')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.enable_rtl_desc', 'Support right-to-left languages (experimental)')}
                    </p>
                  </div>
                  <Switch
                    checked={config.enableRTL}
                    onCheckedChange={(checked) => updateConfig({ enableRTL: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.localization', 'Localization')}</CardTitle>
              <CardDescription>
                {t('settings.localization_desc', 'Configure date, number, and currency formatting')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.date_localization', 'Date Localization')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.date_desc', 'Format dates according to selected language')}
                  </p>
                </div>
                <Switch
                  checked={config.dateLocalization}
                  onCheckedChange={(checked) => updateConfig({ dateLocalization: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.number_localization', 'Number Localization')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.number_desc', 'Format numbers according to selected language')}
                  </p>
                </div>
                <Switch
                  checked={config.numberLocalization}
                  onCheckedChange={(checked) => updateConfig({ numberLocalization: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.currency_localization', 'Currency Localization')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.currency_desc', 'Format currency according to selected language')}
                  </p>
                </div>
                <Switch
                  checked={config.currencyLocalization}
                  onCheckedChange={(checked) => updateConfig({ currencyLocalization: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 性能设置 */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t('settings.caching', 'Translation Caching')}
              </CardTitle>
              <CardDescription>
                {t('settings.caching_desc', 'Configure translation caching for better performance')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.enable_cache', 'Enable Translation Cache')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.enable_cache_desc', 'Cache translations in memory for faster access')}
                  </p>
                </div>
                <Switch
                  checked={config.enableTranslationCache}
                  onCheckedChange={(checked) => updateConfig({ enableTranslationCache: checked })}
                />
              </div>

              {config.enableTranslationCache && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('settings.cache_timeout', 'Cache Timeout (minutes)')}</Label>
                      <Input
                        type="number"
                        value={Math.round(config.cacheTimeout / (60 * 1000))}
                        onChange={(e) => updateConfig({ 
                          cacheTimeout: parseInt(e.target.value) * 60 * 1000 
                        })}
                        min="1"
                        max="1440"
                      />
                    </div>

                    <div>
                      <Label>{t('settings.max_cache_size', 'Max Cache Size (entries)')}</Label>
                      <Input
                        type="number"
                        value={config.maxCacheSize}
                        onChange={(e) => updateConfig({ maxCacheSize: parseInt(e.target.value) })}
                        min="100"
                        max="10000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>{t('settings.preload_languages', 'Preload Languages')}</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('settings.preload_desc', 'Languages to preload for faster switching')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <Badge
                          key={lang.code}
                          variant={config.preloadLanguages.includes(lang.code) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const newPreload = config.preloadLanguages.includes(lang.code)
                              ? config.preloadLanguages.filter(l => l !== lang.code)
                              : [...config.preloadLanguages, lang.code];
                            updateConfig({ preloadLanguages: newPreload });
                          }}
                        >
                          {lang.flag} {lang.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API设置 */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t('settings.translation_api', 'Translation API')}
              </CardTitle>
              <CardDescription>
                {t('settings.translation_api_desc', 'Configure automatic translation services')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.enable_api', 'Enable Translation API')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.enable_api_desc', 'Allow automatic translation using external services')}
                  </p>
                </div>
                <Switch
                  checked={config.enableTranslationAPI}
                  onCheckedChange={(checked) => updateConfig({ enableTranslationAPI: checked })}
                />
              </div>

              {config.enableTranslationAPI && config.translationAPI && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('settings.api_provider', 'API Provider')}</Label>
                    <Select 
                      value={config.translationAPI.provider} 
                      onValueChange={(value) => updateConfig({ 
                        translationAPI: { 
                          ...config.translationAPI!, 
                          provider: value as any 
                        } 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google Translate</SelectItem>
                        <SelectItem value="deepl">DeepL</SelectItem>
                        <SelectItem value="azure">Azure Translator</SelectItem>
                        <SelectItem value="custom">Custom API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('settings.api_key', 'API Key')}</Label>
                    <Input
                      type="password"
                      value={config.translationAPI.apiKey || ''}
                      onChange={(e) => updateConfig({ 
                        translationAPI: { 
                          ...config.translationAPI!, 
                          apiKey: e.target.value 
                        } 
                      })}
                      placeholder={t('settings.api_key_placeholder', 'Enter your API key...')}
                    />
                  </div>

                  <div>
                    <Label>{t('settings.rate_limit', 'Rate Limit (requests/minute)')}</Label>
                    <Input
                      type="number"
                      value={config.translationAPI.rateLimit || 100}
                      onChange={(e) => updateConfig({ 
                        translationAPI: { 
                          ...config.translationAPI!, 
                          rateLimit: parseInt(e.target.value) 
                        } 
                      })}
                      min="1"
                      max="1000"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 质量设置 */}
        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('settings.quality_control', 'Quality Control')}
              </CardTitle>
              <CardDescription>
                {t('settings.quality_control_desc', 'Configure translation quality and validation rules')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.show_missing', 'Show Missing Translations')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.show_missing_desc', 'Highlight missing translations in development')}
                  </p>
                </div>
                <Switch
                  checked={config.showMissingTranslations}
                  onCheckedChange={(checked) => updateConfig({ showMissingTranslations: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.log_usage', 'Log Translation Usage')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.log_usage_desc', 'Track which translations are used for analytics')}
                  </p>
                </div>
                <Switch
                  checked={config.logTranslationUsage}
                  onCheckedChange={(checked) => updateConfig({ logTranslationUsage: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分析设置 */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('settings.translation_coverage', 'Translation Coverage')}
              </CardTitle>
              <CardDescription>
                {t('settings.coverage_desc', 'View translation completion status for each language')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {SUPPORTED_LANGUAGES.map(lang => {
                  const coverage = coverageData[lang.code] || 0;
                  const percentage = Math.round(coverage * 100);
                  
                  return (
                    <div key={lang.code} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{lang.flag}</span>
                        <div>
                          <p className="font-medium">{lang.name}</p>
                          <p className="text-sm text-muted-foreground">{lang.nativeName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              percentage >= 90 ? 'bg-green-500' :
                              percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <Badge variant={percentage >= 90 ? 'default' : percentage >= 70 ? 'secondary' : 'destructive'}>
                          {percentage}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.system_info', 'System Information')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">{t('settings.total_languages', 'Total Languages')}</Label>
                  <p className="font-medium">{SUPPORTED_LANGUAGES.length}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('settings.enabled_languages', 'Enabled Languages')}</Label>
                  <p className="font-medium">{config.enabledLanguages.length}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('settings.cache_status', 'Cache Status')}</Label>
                  <div className="flex items-center gap-1">
                    {config.enableTranslationCache ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Info className="h-3 w-3 text-gray-500" />
                    )}
                    <span className="font-medium">
                      {config.enableTranslationCache ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('settings.api_status', 'API Status')}</Label>
                  <div className="flex items-center gap-1">
                    {config.enableTranslationAPI ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Info className="h-3 w-3 text-gray-500" />
                    )}
                    <span className="font-medium">
                      {config.enableTranslationAPI ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
