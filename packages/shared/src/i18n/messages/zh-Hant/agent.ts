/**
 * Traditional Chinese Agent Messages
 * 
 * Agent portal specific messages for agent management,
 * commissions, payouts, and agent dashboard.
 */

export const agent = {
  // Navigation
  nav: {
    dashboard: '儀表板',
    agents: '平台代理',
    commissions: '佣金管理',
    payouts: '支付管理',
    analytics: '分析報告',
    territories: '區域管理',
    levels: '代理等級',
    settings: '系統設定',
    register: '代理註冊',
    registerDesc: '申請成為代理',
    performance: '績效',
    performanceDesc: '追蹤您的績效',
    commissionsDesc: '查看佣金收入',
    payoutsDesc: '管理您的支付',
    customers: '我的客戶',
    customersDesc: '管理推薦客戶',
    marketing: '行銷工具',
    marketingDesc: '推廣素材',
    profile: '個人設定',
    profileDesc: '更新您的個人資料',
  },

  // Header
  header: {
    title: '代理入口',
    subtitle: '代理入口 - 拓展您的業務',
    searchPlaceholder: '搜尋客戶、佣金...',
    agentUser: '代理用戶',
  },

  // User
  user: {
    title: '代理用戶',
    superAdmin: '超級管理員',
    platformManager: '平台經理',
  },

  // Dashboard
  dashboard: {
    title: '儀表板',
    subtitle: '平台代理管理系統',
    welcome: '歡迎使用平台代理管理系統。監控您的代理網路績效並管理佣金。',
    welcomeBack: '歡迎回來，代理！',
    welcomeDesc: '追蹤您的績效、管理客戶，並與 Jiffoo Mall 一起發展您的業務。',
    agentCode: '代理代碼',
    level: '等級',
    regional: '區域',
    totalAgents: '總代理商',
    pendingApplications: '待審核申請',
    totalCommissions: '總佣金',
    pendingPayouts: '待處理支付',
    activeAgents: '活躍',
    awaitingReview: '等待審核',
    paid: '已支付',
    awaitingProcessing: '等待處理',
    fromLastMonth: '較上月',
  },

  // Quick Actions
  quickActions: {
    title: '快速操作',
    referNewCustomer: '推薦新客戶',
    generateReferralLink: '生成推薦連結',
    marketingMaterials: '行銷素材',
    downloadPromotionalContent: '下載推廣內容',
    requestPayout: '申請提款',
    withdrawEarnings: '提取您的收益',
    viewPerformance: '查看績效',
    checkStatistics: '查看您的統計數據',
  },

  // Stats
  stats: {
    totalReferrals: '總推薦數',
    thisMonth: '本月 {count} 個',
    activeCustomers: '活躍客戶',
    conversionRate: '{rate}% 轉換率',
    totalEarnings: '總收益',
    lifetimeCommissions: '終身佣金',
    pendingCommissions: '待處理佣金',
    awaitingPayout: '等待提款',
    yourPerformanceRank: '您的績效排名',
    performingBetter: '您的表現優於大多數代理！',
    outOfAgents: '共 {total} 位代理',
    available: '可用',
    fromLastMonth: '較上月',
  },

  // Agent Distribution
  agents: {
    title: '代理',
    distribution: '依等級分布',
    levels: {
      local: '本地',
      regional: '區域',
      global: '全球',
    },
    totalActive: '總活躍代理',
    newAgent: '新增代理',
    agentDetails: '代理詳情',
    status: '狀態',
    level: '等級',
    territory: '區域',
    commissionRate: '佣金比率',
    totalEarnings: '總收益',
    joinDate: '加入日期',
    approve: '核准',
    reject: '拒絕',
    suspend: '暫停',
    activate: '啟用',
  },

  // Revenue & Commissions
  revenue: {
    title: '收入與佣金',
    revenue: '收入',
    commissions: '佣金',
    totalRevenue: '總收入 (6個月)',
    totalCommissions: '總佣金 (6個月)',
    pending: '待處理',
    approved: '已核准',
    paid: '已支付',
  },

  // Commissions
  commissions: {
    summary: '佣金摘要',
    viewAll: '查看全部',
    totalEarned: '總收益',
    pending: '待處理',
    thisMonth: '本月',
    recentCommissions: '最近佣金',
  },

  // Referrals
  referrals: {
    recentReferrals: '最近推薦',
    viewAllCustomers: '查看所有客戶',
    monthly: '每月',
    earned: '已賺取',
    noReferralsYet: '尚無推薦',
    startReferring: '開始推薦客戶以賺取佣金',
    referFirstCustomer: '推薦您的第一位客戶',
  },

  // Payouts
  payouts: {
    title: '支付',
    pendingPayouts: '待處理支付',
    processedPayouts: '已處理支付',
    amount: '金額',
    agent: '代理',
    requestDate: '申請日期',
    processDate: '處理日期',
    status: '狀態',
    approve: '核准',
    reject: '拒絕',
    process: '處理',
  },

  // Performance
  performance: {
    trends: '績效趨勢',
    earnings: '收益',
    referrals: '推薦',
    activeCustomers: '活躍客戶',
    total: '總計',
    sixMonths: '6個月',
  },

  // Recent Activity
  activity: {
    title: '最近活動',
    recent: '最近活動',
    viewAll: '查看全部',
    newApplication: '新代理申請',
    commissionEarned: '佣金獲得',
    payoutCompleted: '支付完成',
    agentActivated: '代理啟用',
    payoutRequest: '支付請求',
  },

  // Revenue Chart
  revenueChart: {
    title: '營收與佣金',
    revenue: '營收',
    commissions: '佣金',
    totalRevenue6M: '總營收 (6個月)',
    totalCommissions6M: '總佣金 (6個月)',
  },

  // Search
  search: {
    placeholder: '搜尋代理、佣金...',
  },

  // Analytics
  analytics: {
    title: '分析報告',
    performance: '績效',
    growth: '成長',
    trends: '趨勢',
    exportReport: '匯出報告',
  },

  // Territories
  territories: {
    title: '區域管理',
    addTerritory: '新增區域',
    editTerritory: '編輯區域',
    name: '區域名稱',
    region: '地區',
    assignedAgents: '指派的代理',
  },

  // Levels
  levels: {
    title: '代理等級',
    addLevel: '新增等級',
    editLevel: '編輯等級',
    name: '等級名稱',
    commissionRate: '佣金比率',
    requirements: '要求',
  },

  // Settings
  settings: {
    title: '系統設定',
    general: '一般',
    commissions: '佣金',
    payouts: '支付',
    notifications: '通知',
  },
};

