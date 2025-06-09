'use client';

import * as React from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
}

export function LanguageSwitcher({ 
  variant = 'default', 
  className 
}: LanguageSwitcherProps) {
  const { language, setLanguage, isLoading, t } = useI18n();

  const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.code === language) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    if (newLanguage !== language) {
      await setLanguage(newLanguage);
    }
  };

  // 图标模式
  if (variant === 'icon-only') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            disabled={isLoading}
            className={cn("h-9 w-9", className)}
          >
            <Globe className="h-4 w-4" />
            <span className="sr-only">{t('settings.language', 'Switch language')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{lang.flag}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{lang.name}</span>
                  <span className="text-xs text-muted-foreground">{lang.nativeName}</span>
                </div>
              </div>
              {language === lang.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={isLoading}
            className={cn("h-8 px-2 text-xs", className)}
          >
            <span className="mr-1">{currentLang.flag}</span>
            <span className="hidden sm:inline">{currentLang.code}</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center justify-between cursor-pointer text-sm"
            >
              <div className="flex items-center space-x-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </div>
              {language === lang.code && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 默认模式
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={isLoading}
          className={cn("justify-between min-w-[140px]", className)}
        >
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span className="text-sm">{currentLang.nativeName}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          {t('settings.language', 'Language')}
        </div>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">{lang.flag}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{lang.name}</span>
                <span className="text-xs text-muted-foreground">{lang.nativeName}</span>
              </div>
            </div>
            {language === lang.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 语言状态指示器
export function LanguageIndicator({ className }: { className?: string }) {
  const { language } = useI18n();
  const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className={cn("flex items-center space-x-1 text-xs text-muted-foreground", className)}>
      <span>{currentLang.flag}</span>
      <span>{currentLang.code}</span>
    </div>
  );
}

// 语言选择器（用于设置页面）
export function LanguageSelector({ 
  value, 
  onChange, 
  className 
}: { 
  value: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">
        {t('settings.language', 'Language')}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={cn(
              "flex items-center space-x-3 p-3 rounded-lg border text-left transition-colors",
              value === lang.code
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <span className="text-xl">{lang.flag}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">{lang.name}</div>
              <div className="text-xs text-muted-foreground">{lang.nativeName}</div>
            </div>
            {value === lang.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
