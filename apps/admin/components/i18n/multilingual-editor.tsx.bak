'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../lib/i18n';
import { Globe, Check, AlertCircle, Copy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface MultilingualContent {
  [key: string]: string;
}

interface MultilingualEditorProps {
  label: string;
  description?: string;
  value: MultilingualContent;
  onChange: (value: MultilingualContent) => void;
  type?: 'input' | 'textarea' | 'rich';
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  enabledLanguages?: SupportedLanguage[];
}

export function MultilingualEditor({
  label,
  description,
  value,
  onChange,
  type = 'input',
  required = false,
  placeholder,
  maxLength,
  enabledLanguages = SUPPORTED_LANGUAGES.map(l => l.code),
}: MultilingualEditorProps) {
  const { t, language } = useI18n();
  const [activeTab, setActiveTab] = useState<SupportedLanguage>(language);
  const [showValidation, setShowValidation] = useState(false);

  // 获取启用的语言列表
  const availableLanguages = SUPPORTED_LANGUAGES.filter(lang => 
    enabledLanguages.includes(lang.code)
  );

  // 检查内容完整性
  const getCompletionStatus = () => {
    const completed = availableLanguages.filter(lang => 
      value[lang.code]?.trim()
    ).length;
    return { completed, total: availableLanguages.length };
  };

  // 更新特定语言的内容
  const updateContent = (langCode: SupportedLanguage, content: string) => {
    onChange({
      ...value,
      [langCode]: content,
    });
  };

  // 复制内容到其他语言
  const copyToOtherLanguages = (sourceLang: SupportedLanguage) => {
    const sourceContent = value[sourceLang];
    if (!sourceContent?.trim()) {
      toast.error(t('multilingual.no_content_to_copy', 'No content to copy'));
      return;
    }

    const newValue = { ...value };
    availableLanguages.forEach(lang => {
      if (lang.code !== sourceLang && !newValue[lang.code]?.trim()) {
        newValue[lang.code] = sourceContent;
      }
    });

    onChange(newValue);
    toast.success(t('multilingual.copied_to_empty', 'Content copied to empty languages'));
  };

  // 自动翻译（模拟功能）
  const autoTranslate = async (sourceLang: SupportedLanguage) => {
    const sourceContent = value[sourceLang];
    if (!sourceContent?.trim()) {
      toast.error(t('multilingual.no_content_to_translate', 'No content to translate'));
      return;
    }

    toast.info(t('multilingual.translating', 'Translating content...'));
    
    // 模拟翻译API调用
    setTimeout(() => {
      const newValue = { ...value };
      availableLanguages.forEach(lang => {
        if (lang.code !== sourceLang && !newValue[lang.code]?.trim()) {
          // 这里应该调用真实的翻译API
          newValue[lang.code] = `[${lang.code.toUpperCase()}] ${sourceContent}`;
        }
      });

      onChange(newValue);
      toast.success(t('multilingual.translation_complete', 'Translation completed'));
    }, 2000);
  };

  // 验证必填字段
  const validateRequired = () => {
    if (!required) return true;
    
    const hasContent = availableLanguages.some(lang => 
      value[lang.code]?.trim()
    );
    
    setShowValidation(!hasContent);
    return hasContent;
  };

  const status = getCompletionStatus();
  const isComplete = status.completed === status.total;
  const hasPartialContent = status.completed > 0 && status.completed < status.total;

  const renderInput = (langCode: SupportedLanguage) => {
    const currentValue = value[langCode] || '';
    const isOverLimit = maxLength && currentValue.length > maxLength;

    if (type === 'textarea') {
      return (
        <div className="space-y-2">
          <Textarea
            value={currentValue}
            onChange={(e) => updateContent(langCode, e.target.value)}
            placeholder={placeholder}
            className={`min-h-[100px] ${isOverLimit ? 'border-red-500' : ''}`}
            maxLength={maxLength}
          />
          {maxLength && (
            <div className={`text-xs text-right ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
              {currentValue.length}/{maxLength}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Input
          value={currentValue}
          onChange={(e) => updateContent(langCode, e.target.value)}
          placeholder={placeholder}
          className={isOverLimit ? 'border-red-500' : ''}
          maxLength={maxLength}
        />
        {maxLength && (
          <div className={`text-xs text-right ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
            {currentValue.length}/{maxLength}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 标题和状态 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">{label}</Label>
            {required && <span className="text-red-500">*</span>}
            <Badge variant={isComplete ? 'default' : hasPartialContent ? 'secondary' : 'outline'}>
              <Globe className="h-3 w-3 mr-1" />
              {status.completed}/{status.total}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {showValidation && required && status.completed === 0 && (
            <div className="flex items-center gap-1 text-red-500 text-sm">
              <AlertCircle className="h-3 w-3" />
              {t('multilingual.required_field', 'This field is required in at least one language')}
            </div>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToOtherLanguages(activeTab)}
            disabled={!value[activeTab]?.trim()}
          >
            <Copy className="h-3 w-3 mr-1" />
            {t('multilingual.copy', 'Copy')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoTranslate(activeTab)}
            disabled={!value[activeTab]?.trim()}
          >
            <Wand2 className="h-3 w-3 mr-1" />
            {t('multilingual.translate', 'Translate')}
          </Button>
        </div>
      </div>

      {/* 语言标签页 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SupportedLanguage)}>
        <TabsList className="grid w-full grid-cols-auto">
          {availableLanguages.map(lang => {
            const hasContent = value[lang.code]?.trim();
            return (
              <TabsTrigger 
                key={lang.code} 
                value={lang.code}
                className="flex items-center gap-2"
              >
                <span>{lang.flag}</span>
                <span className="hidden sm:inline">{lang.code}</span>
                {hasContent && <Check className="h-3 w-3 text-green-500" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {availableLanguages.map(lang => (
          <TabsContent key={lang.code} value={lang.code} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <div>
                      <CardTitle className="text-base">{lang.name}</CardTitle>
                      <CardDescription className="text-sm">{lang.nativeName}</CardDescription>
                    </div>
                  </div>
                  {value[lang.code]?.trim() && (
                    <Badge variant="outline" className="text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      {t('multilingual.completed', 'Completed')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {renderInput(lang.code)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* 完成度概览 */}
      {availableLanguages.length > 1 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('multilingual.completion_status', 'Completion Status')}
              </span>
              <div className="flex items-center gap-2">
                {availableLanguages.map(lang => (
                  <div
                    key={lang.code}
                    className={`w-3 h-3 rounded-full ${
                      value[lang.code]?.trim() 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`}
                    title={`${lang.nativeName}: ${value[lang.code]?.trim() ? 'Completed' : 'Empty'}`}
                  />
                ))}
                <span className="ml-2 text-muted-foreground">
                  {Math.round((status.completed / status.total) * 100)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 简化版本的多语言输入组件
export function MultilingualInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: MultilingualContent;
  onChange: (value: MultilingualContent) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <MultilingualEditor
      label={label}
      value={value}
      onChange={onChange}
      type="input"
      placeholder={placeholder}
      required={required}
    />
  );
}

// 多语言文本域组件
export function MultilingualTextarea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required = false,
}: {
  label: string;
  value: MultilingualContent;
  onChange: (value: MultilingualContent) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <MultilingualEditor
      label={label}
      value={value}
      onChange={onChange}
      type="textarea"
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
    />
  );
}
