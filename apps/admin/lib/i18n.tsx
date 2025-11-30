'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 支持的语言类型
export type SupportedLanguage = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'es-ES' | 'fr-FR';

// 语言信息接口
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

// 支持的语言列表
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', rtl: false },
  { code: 'en-US', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rtl: false },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
];

// 国际化上下文接口
interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: string, defaultValue?: string, interpolations?: Record<string, string>) => string;
  isLoading: boolean;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | null>(null);

// 翻译缓存
const translationCache = new Map<string, string>();

// Provider组件属性
interface I18nProviderProps {
  children: React.ReactNode;
  defaultLanguage?: SupportedLanguage;
}

// 检测浏览器语言
function detectBrowserLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  
  const browserLang = navigator.language || navigator.languages?.[0];
  const supportedCodes = SUPPORTED_LANGUAGES.map(lang => lang.code);
  
  // 精确匹配
  if (supportedCodes.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage;
  }
  
  // 语言前缀匹配
  const langPrefix = browserLang.split('-')[0];
  const match = supportedCodes.find(code => code.startsWith(langPrefix));
  
  return match as SupportedLanguage || null;
}

export function I18nProvider({ children, defaultLanguage = 'zh-CN' }: I18nProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // 客户端水合
  useEffect(() => {
    setIsHydrated(true);
    
    // 从localStorage获取保存的语言
    const savedLanguage = localStorage.getItem('super-admin-language') as SupportedLanguage;
    if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
      setLanguageState(savedLanguage);
    } else {
      // 自动检测浏览器语言
      const browserLanguage = detectBrowserLanguage();
      if (browserLanguage) {
        setLanguageState(browserLanguage);
      }
    }
    
    setIsLoading(false);
  }, []);

  // 设置语言
  const setLanguage = useCallback((newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('super-admin-language', newLanguage);
    }
  }, []);

  // 翻译函数
  const t = (key: string, defaultValue?: string, interpolations?: Record<string, string>): string => {
    if (!isHydrated) {
      return defaultValue || key;
    }

    const cacheKey = `${language}:${key}`;
    
    // 检查缓存
    if (translationCache.has(cacheKey)) {
      let translation = translationCache.get(cacheKey)!;
      
      // 处理插值
      if (interpolations) {
        Object.entries(interpolations).forEach(([placeholder, value]) => {
          translation = translation.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
        });
      }
      
      return translation;
    }

    // 获取翻译（这里先使用静态翻译，后续可以改为API调用）
    const translation = getStaticTranslation(key, language) || defaultValue || key;
    
    // 缓存翻译
    translationCache.set(cacheKey, translation);
    
    // 处理插值
    let result = translation;
    if (interpolations) {
      Object.entries(interpolations).forEach(([placeholder, value]) => {
        result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
      });
    }
    
    return result;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}

// 使用多语言Hook
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// 静态翻译数据
function getStaticTranslation(key: string, language: SupportedLanguage): string | undefined {
  const translations: Record<SupportedLanguage, Record<string, string>> = {
    'zh-CN': {
      // 通用
      'common.save': '保存',
      'common.cancel': '取消',
      'common.edit': '编辑',
      'common.delete': '删除',
      'common.view': '查看',
      'common.search': '搜索',
      'common.loading': '加载中...',
      'common.error': '错误',
      'common.success': '成功',
      
      // 导航
      'nav.dashboard': '仪表板',
      'nav.agents': '平台代理',
      'nav.commissions': '佣金管理',
      'nav.payouts': '支付管理',
      'nav.analytics': '分析报告',
      'nav.territories': '区域管理',
      'nav.levels': '代理等级',
      'nav.settings': '系统设置',
      
      // 仪表板
      'dashboard.title': '仪表板',
      'dashboard.subtitle': '平台代理管理系统',
      'dashboard.welcome': '欢迎使用平台代理管理系统。监控您的代理网络性能并管理佣金。',
      'dashboard.totalAgents': '总代理商',
      'dashboard.pendingApplications': '待审核申请',
      'dashboard.totalCommissions': '总佣金',
      'dashboard.pendingPayouts': '待处理支付',
      'dashboard.activeAgents': '活跃代理',
      'dashboard.awaitingReview': '等待审核',
      'dashboard.paid': '已支付',
      'dashboard.awaitingProcessing': '等待处理',
      'dashboard.fromLastMonth': '较上月',
      
      // 代理分布
      'agents.distribution': '代理分布按等级',
      'agents.level.local': '本地',
      'agents.level.regional': '区域',
      'agents.level.global': '全球',
      'agents.totalActive': '总活跃代理',
      
      // 收入佣金
      'revenue.title': '收入与佣金',
      'revenue.revenue': '收入',
      'revenue.commissions': '佣金',
      'revenue.totalRevenue': '总收入 (6个月)',
      'revenue.totalCommissions': '总佣金 (6个月)',
      
      // 最近活动
      'activity.recent': '最近活动',
      'activity.viewAll': '查看全部',
      'activity.newApplication': '新代理申请',
      'activity.commissionEarned': '佣金获得',
      'activity.payoutCompleted': '支付完成',
      'activity.agentActivated': '代理激活',
      'activity.payoutRequest': '支付请求',
      
      // 搜索
      'search.placeholder': '搜索代理商、佣金...',
      
      // 用户信息
      'user.superAdmin': '超级管理员',
      'user.platformManager': '平台管理员',
    },
    'en-US': {
      // Common
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.edit': 'Edit',
      'common.delete': 'Delete',
      'common.view': 'View',
      'common.search': 'Search',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.agents': 'Platform Agents',
      'nav.commissions': 'Commission Management',
      'nav.payouts': 'Payout Management',
      'nav.analytics': 'Analytics & Reports',
      'nav.territories': 'Territory Management',
      'nav.levels': 'Agent Levels',
      'nav.settings': 'System Settings',
      
      // Dashboard
      'dashboard.title': 'Dashboard',
      'dashboard.subtitle': 'Platform Agents Management System',
      'dashboard.welcome': 'Welcome to the Platform Agents Management System. Monitor your agent network performance and manage commissions.',
      'dashboard.totalAgents': 'Total Agents',
      'dashboard.pendingApplications': 'Pending Applications',
      'dashboard.totalCommissions': 'Total Commissions',
      'dashboard.pendingPayouts': 'Pending Payouts',
      'dashboard.activeAgents': 'active',
      'dashboard.awaitingReview': 'Awaiting review',
      'dashboard.paid': 'paid',
      'dashboard.awaitingProcessing': 'Awaiting processing',
      'dashboard.fromLastMonth': 'from last month',
      
      // Agent Distribution
      'agents.distribution': 'Agent Distribution by Level',
      'agents.level.local': 'LOCAL',
      'agents.level.regional': 'REGIONAL',
      'agents.level.global': 'GLOBAL',
      'agents.totalActive': 'Total Active Agents',
      
      // Revenue & Commissions
      'revenue.title': 'Revenue & Commissions',
      'revenue.revenue': 'Revenue',
      'revenue.commissions': 'Commissions',
      'revenue.totalRevenue': 'Total Revenue (6M)',
      'revenue.totalCommissions': 'Total Commissions (6M)',
      
      // Recent Activity
      'activity.recent': 'Recent Activity',
      'activity.viewAll': 'View all',
      'activity.newApplication': 'New Agent Application',
      'activity.commissionEarned': 'Commission Earned',
      'activity.payoutCompleted': 'Payout Completed',
      'activity.agentActivated': 'Agent Activated',
      'activity.payoutRequest': 'Payout Request',
      
      // Search
      'search.placeholder': 'Search agents, commissions...',
      
      // User Info
      'user.superAdmin': 'Super Admin',
      'user.platformManager': 'Platform Manager',
    },
    'ja-JP': {
      // 通用
      'common.save': '保存',
      'common.cancel': 'キャンセル',
      'common.edit': '編集',
      'common.delete': '削除',
      'common.view': '表示',
      'common.search': '検索',
      'common.loading': '読み込み中...',
      'common.error': 'エラー',
      'common.success': '成功',
      
      // ナビゲーション
      'nav.dashboard': 'ダッシュボード',
      'nav.agents': 'プラットフォームエージェント',
      'nav.commissions': 'コミッション管理',
      'nav.payouts': '支払い管理',
      'nav.analytics': '分析レポート',
      'nav.territories': '地域管理',
      'nav.levels': 'エージェントレベル',
      'nav.settings': 'システム設定',
      
      // ダッシュボード
      'dashboard.title': 'ダッシュボード',
      'dashboard.subtitle': 'プラットフォームエージェント管理システム',
      'dashboard.welcome': 'プラットフォームエージェント管理システムへようこそ。エージェントネットワークのパフォーマンスを監視し、コミッションを管理します。',
      'dashboard.totalAgents': '総エージェント数',
      'dashboard.pendingApplications': '保留中の申請',
      'dashboard.totalCommissions': '総コミッション',
      'dashboard.pendingPayouts': '保留中の支払い',
      'dashboard.activeAgents': 'アクティブ',
      'dashboard.awaitingReview': '審査待ち',
      'dashboard.paid': '支払済み',
      'dashboard.awaitingProcessing': '処理待ち',
      'dashboard.fromLastMonth': '先月から',
      
      // エージェント分布
      'agents.distribution': 'レベル別エージェント分布',
      'agents.level.local': 'ローカル',
      'agents.level.regional': 'リージョナル',
      'agents.level.global': 'グローバル',
      'agents.totalActive': '総アクティブエージェント',
      
      // 収益とコミッション
      'revenue.title': '収益とコミッション',
      'revenue.revenue': '収益',
      'revenue.commissions': 'コミッション',
      'revenue.totalRevenue': '総収益（6ヶ月）',
      'revenue.totalCommissions': '総コミッション（6ヶ月）',
      
      // 最近のアクティビティ
      'activity.recent': '最近のアクティビティ',
      'activity.viewAll': 'すべて表示',
      'activity.newApplication': '新しいエージェント申請',
      'activity.commissionEarned': 'コミッション獲得',
      'activity.payoutCompleted': '支払い完了',
      'activity.agentActivated': 'エージェント有効化',
      'activity.payoutRequest': '支払いリクエスト',
      
      // 検索
      'search.placeholder': 'エージェント、コミッションを検索...',
      
      // ユーザー情報
      'user.superAdmin': 'スーパー管理者',
      'user.platformManager': 'プラットフォーム管理者',
    },
    'ko-KR': {
      // 공통
      'common.save': '저장',
      'common.cancel': '취소',
      'common.edit': '편집',
      'common.delete': '삭제',
      'common.view': '보기',
      'common.search': '검색',
      'common.loading': '로딩 중...',
      'common.error': '오류',
      'common.success': '성공',
      
      // 네비게이션
      'nav.dashboard': '대시보드',
      'nav.agents': '플랫폼 에이전트',
      'nav.commissions': '커미션 관리',
      'nav.payouts': '지급 관리',
      'nav.analytics': '분석 보고서',
      'nav.territories': '지역 관리',
      'nav.levels': '에이전트 레벨',
      'nav.settings': '시스템 설정',
      
      // 대시보드
      'dashboard.title': '대시보드',
      'dashboard.subtitle': '플랫폼 에이전트 관리 시스템',
      'dashboard.welcome': '플랫폼 에이전트 관리 시스템에 오신 것을 환영합니다. 에이전트 네트워크 성능을 모니터링하고 커미션을 관리하세요.',
      'dashboard.totalAgents': '총 에이전트',
      'dashboard.pendingApplications': '대기 중인 신청',
      'dashboard.totalCommissions': '총 커미션',
      'dashboard.pendingPayouts': '대기 중인 지급',
      'dashboard.activeAgents': '활성',
      'dashboard.awaitingReview': '검토 대기',
      'dashboard.paid': '지급됨',
      'dashboard.awaitingProcessing': '처리 대기',
      'dashboard.fromLastMonth': '지난 달 대비',
      
      // 에이전트 분포
      'agents.distribution': '레벨별 에이전트 분포',
      'agents.level.local': '로컬',
      'agents.level.regional': '지역',
      'agents.level.global': '글로벌',
      'agents.totalActive': '총 활성 에이전트',
      
      // 수익 및 커미션
      'revenue.title': '수익 및 커미션',
      'revenue.revenue': '수익',
      'revenue.commissions': '커미션',
      'revenue.totalRevenue': '총 수익 (6개월)',
      'revenue.totalCommissions': '총 커미션 (6개월)',
      
      // 최근 활동
      'activity.recent': '최근 활동',
      'activity.viewAll': '모두 보기',
      'activity.newApplication': '새 에이전트 신청',
      'activity.commissionEarned': '커미션 획득',
      'activity.payoutCompleted': '지급 완료',
      'activity.agentActivated': '에이전트 활성화',
      'activity.payoutRequest': '지급 요청',
      
      // 검색
      'search.placeholder': '에이전트, 커미션 검색...',
      
      // 사용자 정보
      'user.superAdmin': '슈퍼 관리자',
      'user.platformManager': '플랫폼 관리자',
    },
    'es-ES': {
      // Común
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.edit': 'Editar',
      'common.delete': 'Eliminar',
      'common.view': 'Ver',
      'common.search': 'Buscar',
      'common.loading': 'Cargando...',
      'common.error': 'Error',
      'common.success': 'Éxito',
      
      // Navegación
      'nav.dashboard': 'Panel',
      'nav.agents': 'Agentes de Plataforma',
      'nav.commissions': 'Gestión de Comisiones',
      'nav.payouts': 'Gestión de Pagos',
      'nav.analytics': 'Análisis e Informes',
      'nav.territories': 'Gestión de Territorios',
      'nav.levels': 'Niveles de Agente',
      'nav.settings': 'Configuración del Sistema',
      
      // Panel
      'dashboard.title': 'Panel',
      'dashboard.subtitle': 'Sistema de Gestión de Agentes de Plataforma',
      'dashboard.welcome': 'Bienvenido al Sistema de Gestión de Agentes de Plataforma. Monitorea el rendimiento de tu red de agentes y gestiona comisiones.',
      'dashboard.totalAgents': 'Total de Agentes',
      'dashboard.pendingApplications': 'Solicitudes Pendientes',
      'dashboard.totalCommissions': 'Comisiones Totales',
      'dashboard.pendingPayouts': 'Pagos Pendientes',
      'dashboard.activeAgents': 'activos',
      'dashboard.awaitingReview': 'Esperando revisión',
      'dashboard.paid': 'pagado',
      'dashboard.awaitingProcessing': 'Esperando procesamiento',
      'dashboard.fromLastMonth': 'del mes pasado',
      
      // Distribución de Agentes
      'agents.distribution': 'Distribución de Agentes por Nivel',
      'agents.level.local': 'LOCAL',
      'agents.level.regional': 'REGIONAL',
      'agents.level.global': 'GLOBAL',
      'agents.totalActive': 'Total de Agentes Activos',
      
      // Ingresos y Comisiones
      'revenue.title': 'Ingresos y Comisiones',
      'revenue.revenue': 'Ingresos',
      'revenue.commissions': 'Comisiones',
      'revenue.totalRevenue': 'Ingresos Totales (6M)',
      'revenue.totalCommissions': 'Comisiones Totales (6M)',
      
      // Actividad Reciente
      'activity.recent': 'Actividad Reciente',
      'activity.viewAll': 'Ver todo',
      'activity.newApplication': 'Nueva Solicitud de Agente',
      'activity.commissionEarned': 'Comisión Ganada',
      'activity.payoutCompleted': 'Pago Completado',
      'activity.agentActivated': 'Agente Activado',
      'activity.payoutRequest': 'Solicitud de Pago',
      
      // Búsqueda
      'search.placeholder': 'Buscar agentes, comisiones...',
      
      // Información del Usuario
      'user.superAdmin': 'Super Administrador',
      'user.platformManager': 'Gestor de Plataforma',
    },
    'fr-FR': {
      // Commun
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
      'common.edit': 'Modifier',
      'common.delete': 'Supprimer',
      'common.view': 'Voir',
      'common.search': 'Rechercher',
      'common.loading': 'Chargement...',
      'common.error': 'Erreur',
      'common.success': 'Succès',
      
      // Navigation
      'nav.dashboard': 'Tableau de bord',
      'nav.agents': 'Agents de Plateforme',
      'nav.commissions': 'Gestion des Commissions',
      'nav.payouts': 'Gestion des Paiements',
      'nav.analytics': 'Analyses et Rapports',
      'nav.territories': 'Gestion des Territoires',
      'nav.levels': 'Niveaux d\'Agent',
      'nav.settings': 'Paramètres Système',
      
      // Tableau de bord
      'dashboard.title': 'Tableau de bord',
      'dashboard.subtitle': 'Système de Gestion des Agents de Plateforme',
      'dashboard.welcome': 'Bienvenue dans le Système de Gestion des Agents de Plateforme. Surveillez les performances de votre réseau d\'agents et gérez les commissions.',
      'dashboard.totalAgents': 'Total des Agents',
      'dashboard.pendingApplications': 'Candidatures en Attente',
      'dashboard.totalCommissions': 'Commissions Totales',
      'dashboard.pendingPayouts': 'Paiements en Attente',
      'dashboard.activeAgents': 'actifs',
      'dashboard.awaitingReview': 'En attente d\'examen',
      'dashboard.paid': 'payé',
      'dashboard.awaitingProcessing': 'En attente de traitement',
      'dashboard.fromLastMonth': 'du mois dernier',
      
      // Distribution des Agents
      'agents.distribution': 'Distribution des Agents par Niveau',
      'agents.level.local': 'LOCAL',
      'agents.level.regional': 'RÉGIONAL',
      'agents.level.global': 'GLOBAL',
      'agents.totalActive': 'Total des Agents Actifs',
      
      // Revenus et Commissions
      'revenue.title': 'Revenus et Commissions',
      'revenue.revenue': 'Revenus',
      'revenue.commissions': 'Commissions',
      'revenue.totalRevenue': 'Revenus Totaux (6M)',
      'revenue.totalCommissions': 'Commissions Totales (6M)',
      
      // Activité Récente
      'activity.recent': 'Activité Récente',
      'activity.viewAll': 'Voir tout',
      'activity.newApplication': 'Nouvelle Candidature d\'Agent',
      'activity.commissionEarned': 'Commission Gagnée',
      'activity.payoutCompleted': 'Paiement Terminé',
      'activity.agentActivated': 'Agent Activé',
      'activity.payoutRequest': 'Demande de Paiement',
      
      // Recherche
      'search.placeholder': 'Rechercher agents, commissions...',
      
      // Informations Utilisateur
      'user.superAdmin': 'Super Administrateur',
      'user.platformManager': 'Gestionnaire de Plateforme',
    },
  };

  return translations[language]?.[key];
}

// 格式化函数
export function formatDate(date: Date, language: SupportedLanguage): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return new Intl.DateTimeFormat(language, options).format(date);
}

export function formatCurrency(amount: number, language: SupportedLanguage): string {
  const currencyMap: Record<SupportedLanguage, string> = {
    'zh-CN': 'CNY',
    'en-US': 'USD',
    'ja-JP': 'JPY',
    'ko-KR': 'KRW',
    'es-ES': 'EUR',
    'fr-FR': 'EUR',
  };
  
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: currencyMap[language],
  }).format(amount);
}

export function formatNumber(number: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(language).format(number);
}
