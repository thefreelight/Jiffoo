'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../lib/i18n';
import { Search, Plus, Edit, Trash2, Download, Upload, Globe, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface TranslationEntry {
  key: string;
  translations: Record<SupportedLanguage, string>;
  category: string;
  description?: string;
  lastModified: Date;
}

// 模拟翻译数据
const mockTranslations: TranslationEntry[] = [
  {
    key: 'nav.dashboard',
    translations: {
      'zh-CN': '仪表板',
      'en-US': 'Dashboard',
      'ja-JP': 'ダッシュボード',
      'ko-KR': '대시보드',
      'es-ES': 'Panel de control',
      'fr-FR': 'Tableau de bord',
    },
    category: 'navigation',
    description: 'Main dashboard navigation item',
    lastModified: new Date(),
  },
  {
    key: 'common.save',
    translations: {
      'zh-CN': '保存',
      'en-US': 'Save',
      'ja-JP': '保存',
      'ko-KR': '저장',
      'es-ES': 'Guardar',
      'fr-FR': 'Enregistrer',
    },
    category: 'common',
    description: 'Save button text',
    lastModified: new Date(),
  },
];

export function TranslationManager() {
  const { t, language } = useI18n();
  const [translations, setTranslations] = useState<TranslationEntry[]>(mockTranslations);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newTranslation, setNewTranslation] = useState({
    key: '',
    category: 'common',
    description: '',
    translations: {} as Record<SupportedLanguage, string>,
  });

  // 获取所有分类
  const categories = Array.from(new Set(translations.map(t => t.category)));

  // 过滤翻译
  const filteredTranslations = translations.filter(translation => {
    const matchesSearch = translation.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         Object.values(translation.translations).some(t => 
                           t.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesCategory = selectedCategory === 'all' || translation.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 检查翻译完整性
  const getTranslationStatus = (translation: TranslationEntry) => {
    const totalLanguages = SUPPORTED_LANGUAGES.length;
    const completedLanguages = SUPPORTED_LANGUAGES.filter(lang => 
      translation.translations[lang.code]?.trim()
    ).length;
    return { completed: completedLanguages, total: totalLanguages };
  };

  // 添加新翻译
  const handleAddTranslation = () => {
    if (!newTranslation.key.trim()) {
      toast.error(t('translation.key_required', 'Translation key is required'));
      return;
    }

    if (translations.find(t => t.key === newTranslation.key)) {
      toast.error(t('translation.key_exists', 'Translation key already exists'));
      return;
    }

    const entry: TranslationEntry = {
      key: newTranslation.key,
      translations: newTranslation.translations,
      category: newTranslation.category,
      description: newTranslation.description,
      lastModified: new Date(),
    };

    setTranslations([...translations, entry]);
    setNewTranslation({
      key: '',
      category: 'common',
      description: '',
      translations: {} as Record<SupportedLanguage, string>,
    });
    toast.success(t('translation.added', 'Translation added successfully'));
  };

  // 更新翻译
  const handleUpdateTranslation = (key: string, updates: Partial<TranslationEntry>) => {
    setTranslations(translations.map(t => 
      t.key === key 
        ? { ...t, ...updates, lastModified: new Date() }
        : t
    ));
    setEditingKey(null);
    toast.success(t('translation.updated', 'Translation updated successfully'));
  };

  // 删除翻译
  const handleDeleteTranslation = (key: string) => {
    setTranslations(translations.filter(t => t.key !== key));
    toast.success(t('translation.deleted', 'Translation deleted successfully'));
  };

  // 导出翻译
  const handleExportTranslations = () => {
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      translations: translations,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(t('translation.exported', 'Translations exported successfully'));
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('translation.manager', 'Translation Manager')}
          </h1>
          <p className="text-muted-foreground">
            {t('translation.manager_desc', 'Manage translations for the admin interface')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportTranslations}>
            <Download className="h-4 w-4 mr-2" />
            {t('common.export', 'Export')}
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            {t('common.import', 'Import')}
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{t('translation.total_keys', 'Total Keys')}</p>
                <p className="text-2xl font-bold">{translations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t('translation.completed', 'Completed')}</p>
                <p className="text-2xl font-bold">
                  {translations.filter(t => getTranslationStatus(t).completed === getTranslationStatus(t).total).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <X className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">{t('translation.incomplete', 'Incomplete')}</p>
                <p className="text-2xl font-bold">
                  {translations.filter(t => getTranslationStatus(t).completed < getTranslationStatus(t).total).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium">{t('translation.languages', 'Languages')}</p>
                <p className="text-2xl font-bold">{SUPPORTED_LANGUAGES.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manage">{t('translation.manage', 'Manage')}</TabsTrigger>
          <TabsTrigger value="add">{t('translation.add_new', 'Add New')}</TabsTrigger>
          <TabsTrigger value="bulk">{t('translation.bulk_edit', 'Bulk Edit')}</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="space-y-4">
          {/* 搜索和过滤 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('translation.search_placeholder', 'Search translations...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('translation.all_categories', 'All Categories')}</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as SupportedLanguage)}>
                  <SelectTrigger className="w-48">
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
            </CardContent>
          </Card>

          {/* 翻译列表 */}
          <div className="space-y-2">
            {filteredTranslations.map((translation) => {
              const status = getTranslationStatus(translation);
              const isComplete = status.completed === status.total;
              
              return (
                <Card key={translation.key}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {translation.key}
                          </code>
                          <Badge variant={isComplete ? 'default' : 'secondary'}>
                            {status.completed}/{status.total}
                          </Badge>
                          <Badge variant="outline">{translation.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {translation.description}
                        </p>
                        <p className="font-medium">
                          {translation.translations[selectedLanguage] || 
                           t('translation.no_translation', 'No translation available')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingKey(translation.key)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTranslation(translation.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('translation.add_new', 'Add New Translation')}</CardTitle>
              <CardDescription>
                {t('translation.add_new_desc', 'Create a new translation entry for all supported languages')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="key">{t('translation.key', 'Translation Key')}</Label>
                  <Input
                    id="key"
                    value={newTranslation.key}
                    onChange={(e) => setNewTranslation({...newTranslation, key: e.target.value})}
                    placeholder="e.g., nav.dashboard"
                  />
                </div>
                <div>
                  <Label htmlFor="category">{t('translation.category', 'Category')}</Label>
                  <Select 
                    value={newTranslation.category} 
                    onValueChange={(value) => setNewTranslation({...newTranslation, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">{t('translation.new_category', 'New Category')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">{t('translation.description', 'Description')}</Label>
                <Textarea
                  id="description"
                  value={newTranslation.description}
                  onChange={(e) => setNewTranslation({...newTranslation, description: e.target.value})}
                  placeholder={t('translation.description_placeholder', 'Describe what this translation is used for...')}
                />
              </div>

              <div className="space-y-3">
                <Label>{t('translation.translations', 'Translations')}</Label>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <div key={lang.code} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32">
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium">{lang.code}</span>
                    </div>
                    <Input
                      value={newTranslation.translations[lang.code] || ''}
                      onChange={(e) => setNewTranslation({
                        ...newTranslation,
                        translations: {
                          ...newTranslation.translations,
                          [lang.code]: e.target.value
                        }
                      })}
                      placeholder={`Translation in ${lang.nativeName}`}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={handleAddTranslation} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t('translation.add', 'Add Translation')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('translation.bulk_edit', 'Bulk Edit')}</CardTitle>
              <CardDescription>
                {t('translation.bulk_edit_desc', 'Edit multiple translations at once')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('translation.bulk_coming_soon', 'Bulk edit functionality coming soon...')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
