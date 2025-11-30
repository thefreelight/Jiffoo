/**
 * English Agent Messages
 * 
 * Agent portal specific messages for agent management,
 * commissions, payouts, and agent dashboard.
 */

export const agent = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    agents: 'Platform Agents',
    commissions: 'Commission Management',
    payouts: 'Payout Management',
    analytics: 'Analytics & Reports',
    territories: 'Territory Management',
    levels: 'Agent Levels',
    settings: 'System Settings',
    register: 'Agent Registration',
    registerDesc: 'Apply to become an agent',
    performance: 'Performance',
    performanceDesc: 'Track your performance',
    commissionsDesc: 'View commission earnings',
    payoutsDesc: 'Manage your payouts',
    customers: 'My Customers',
    customersDesc: 'Manage referred customers',
    marketing: 'Marketing Tools',
    marketingDesc: 'Promotional materials',
    profile: 'Profile Settings',
    profileDesc: 'Update your profile',
  },

  // Header
  header: {
    title: 'Agent Portal',
    subtitle: 'Agent Portal - Grow Your Business',
    searchPlaceholder: 'Search customers, commissions...',
    agentUser: 'Agent User',
  },

  // User
  user: {
    title: 'Agent User',
    superAdmin: 'Super Admin',
    platformManager: 'Platform Manager',
  },

  // Dashboard
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Platform Agents Management System',
    welcome: 'Welcome to the Platform Agents Management System. Monitor your agent network performance and manage commissions.',
    welcomeBack: 'Welcome back, Agent!',
    welcomeDesc: 'Track your performance, manage customers, and grow your business with Jiffoo Mall.',
    agentCode: 'Agent Code',
    level: 'Level',
    regional: 'Regional',
    totalAgents: 'Total Agents',
    pendingApplications: 'Pending Applications',
    totalCommissions: 'Total Commissions',
    pendingPayouts: 'Pending Payouts',
    activeAgents: 'active',
    awaitingReview: 'Awaiting review',
    paid: 'paid',
    awaitingProcessing: 'Awaiting processing',
    fromLastMonth: 'from last month',
  },

  // Quick Actions
  quickActions: {
    title: 'Quick Actions',
    referNewCustomer: 'Refer New Customer',
    generateReferralLink: 'Generate referral link',
    marketingMaterials: 'Marketing Materials',
    downloadPromotionalContent: 'Download promotional content',
    requestPayout: 'Request Payout',
    withdrawEarnings: 'Withdraw your earnings',
    viewPerformance: 'View Performance',
    checkStatistics: 'Check your statistics',
  },

  // Stats
  stats: {
    totalReferrals: 'Total Referrals',
    thisMonth: '{count} this month',
    activeCustomers: 'Active Customers',
    conversionRate: '{rate}% conversion rate',
    totalEarnings: 'Total Earnings',
    lifetimeCommissions: 'Lifetime commissions',
    pendingCommissions: 'Pending Commissions',
    awaitingPayout: 'Awaiting payout',
    yourPerformanceRank: 'Your Performance Rank',
    performingBetter: "You're performing better than most agents!",
    outOfAgents: 'out of {total} agents',
    available: 'available',
    fromLastMonth: 'from last month',
  },

  // Agent Distribution
  agents: {
    title: 'Agents',
    distribution: 'Agent Distribution by Level',
    levels: {
      local: 'LOCAL',
      regional: 'REGIONAL',
      global: 'GLOBAL',
    },
    totalActive: 'Total Active Agents',
    newAgent: 'New Agent',
    agentDetails: 'Agent Details',
    status: 'Status',
    level: 'Level',
    territory: 'Territory',
    commissionRate: 'Commission Rate',
    totalEarnings: 'Total Earnings',
    joinDate: 'Join Date',
    approve: 'Approve',
    reject: 'Reject',
    suspend: 'Suspend',
    activate: 'Activate',
  },

  // Revenue & Commissions
  revenue: {
    title: 'Revenue & Commissions',
    revenue: 'Revenue',
    commissions: 'Commissions',
    totalRevenue: 'Total Revenue (6M)',
    totalCommissions: 'Total Commissions (6M)',
    pending: 'Pending',
    approved: 'Approved',
    paid: 'Paid',
  },

  // Commissions
  commissions: {
    summary: 'Commission Summary',
    viewAll: 'View all',
    totalEarned: 'Total Earned',
    pending: 'Pending',
    thisMonth: 'This Month',
    recentCommissions: 'Recent Commissions',
  },

  // Referrals
  referrals: {
    recentReferrals: 'Recent Referrals',
    viewAllCustomers: 'View all customers',
    monthly: 'Monthly',
    earned: 'Earned',
    noReferralsYet: 'No referrals yet',
    startReferring: 'Start referring customers to earn commissions',
    referFirstCustomer: 'Refer Your First Customer',
  },

  // Performance
  performance: {
    trends: 'Performance Trends',
    earnings: 'Earnings',
    referrals: 'Referrals',
    activeCustomers: 'Active Customers',
    total: 'Total',
    sixMonths: '6 months',
  },

  // Payouts
  payouts: {
    title: 'Payouts',
    pendingPayouts: 'Pending Payouts',
    processedPayouts: 'Processed Payouts',
    amount: 'Amount',
    agent: 'Agent',
    requestDate: 'Request Date',
    processDate: 'Process Date',
    status: 'Status',
    approve: 'Approve',
    reject: 'Reject',
    process: 'Process',
  },

  // Recent Activity
  activity: {
    title: 'Recent Activity',
    recent: 'Recent Activity',
    viewAll: 'View all',
    newApplication: 'New Agent Application',
    commissionEarned: 'Commission Earned',
    payoutCompleted: 'Payout Completed',
    agentActivated: 'Agent Activated',
    payoutRequest: 'Payout Request',
  },

  // Revenue Chart
  revenueChart: {
    title: 'Revenue & Commissions',
    revenue: 'Revenue',
    commissions: 'Commissions',
    totalRevenue6M: 'Total Revenue (6M)',
    totalCommissions6M: 'Total Commissions (6M)',
  },

  // Search
  search: {
    placeholder: 'Search agents, commissions...',
  },

  // Analytics
  analytics: {
    title: 'Analytics & Reports',
    performance: 'Performance',
    growth: 'Growth',
    trends: 'Trends',
    exportReport: 'Export Report',
  },

  // Territories
  territories: {
    title: 'Territory Management',
    addTerritory: 'Add Territory',
    editTerritory: 'Edit Territory',
    name: 'Territory Name',
    region: 'Region',
    assignedAgents: 'Assigned Agents',
  },

  // Levels
  levels: {
    title: 'Agent Levels',
    addLevel: 'Add Level',
    editLevel: 'Edit Level',
    name: 'Level Name',
    commissionRate: 'Commission Rate',
    requirements: 'Requirements',
  },

  // Settings
  settings: {
    title: 'System Settings',
    general: 'General',
    commissions: 'Commissions',
    payouts: 'Payouts',
    notifications: 'Notifications',
  },
};

