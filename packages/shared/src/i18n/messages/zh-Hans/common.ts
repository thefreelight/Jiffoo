/**
 * Simplified Chinese Common Messages
 * 
 * Cross-application common messages including buttons, system prompts,
 * error states, and other shared UI text.
 */

export const common = {
  // Direct access keys
  noData: '没有可用的资料',
  loading: '载入中...',
  redirecting: '正在跳转...',
  unknown: '未知',
  cancel: '取消',

  // Actions
  actions: {
    save: '储存',
    saveChanges: '储存变更',
    cancel: '取消',
    edit: '编辑',
    update: '更新',
    delete: '删除',
    view: '查看',
    search: '搜寻',
    create: '建立',
    add: '新增',
    remove: '移除',
    confirm: '确认',
    submit: '提交',
    reset: '重设',
    clear: '清除',
    close: '关闭',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    refresh: '重新整理',
    retry: '重试',
    loading: '载入中...',
    saving: '储存中...',
    processing: '处理中...',
    apply: '套用',
    filter: '筛选',
    sort: '排序',
    export: '汇出',
    import: '汇入',
    download: '下载',
    upload: '上传',
    uploading: '上传中...',
    copy: '复制',
    share: '分享',
    print: '列印',
    selectAll: '全选',
    deselectAll: '取消全选',
    goHome: '返回首页',
    continueShopping: '继续购物',
    configure: '设定',
  },

  // Status
  status: {
    loading: '载入中',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '资讯',
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    active: '启用',
    inactive: '停用',
    enabled: '已启用',
    disabled: '已停用',
    shipped: '已发货',
    delivered: '已送达',
  },

  // Common messages
  messages: {
    saveSuccess: '储存成功',
    saveFailed: '储存失败',
  },

  // Labels
  labels: {
    file: '档案',
    by: '由',
    builtin: '内建',
    pages: '页面',
    more: '更多',
    groups: '群组',
    reviews: '评论',
    analytics: '分析',
    salesReport: '销售报告',
    overview: '概览',
    authentication: '身份验证',
    utility: '工具',
    finance: '财务',
  },

  // Validation
  validation: {
    required: '此栏位为必填',
    invalidEmail: '请输入有效的电子邮件地址',
    invalidPhone: '请输入有效的电话号码',
    invalidUrl: '请输入有效的网址',
    minLength: '至少需要 {min} 个字元',
    maxLength: '不可超过 {max} 个字元',
    passwordMismatch: '密码不相符',
    invalidFormat: '格式无效',
  },

  // Error messages
  errors: {
    general: '发生错误，请重试。',
    notFound: '找不到资料',
    unauthorized: '未授权的存取',
    forbidden: '禁止存取',
    serverError: '伺服器错误，请稍后重试。',
    networkError: '网路错误，请检查您的连线。',
    rateLimited: '请求过于频繁，请稍后再试。',
    timeout: '请求逾时，请重试。',
    unknown: '发生未知错误',
    themeUnavailable: '主题组件不可用',
    componentUnavailable: '无法载入组件',
    cartUnavailable: '无法载入购物车组件',
    productsUnavailable: '无法载入商品组件',
    checkoutUnavailable: '无法载入结帐组件',
    validation: '验证错误',
    tryAgain: '请重试',
    error: '错误',
  },

  // Empty states
  empty: {
    noData: '没有可用的资料',
    noResults: '找不到结果',
    noItems: '没有项目',
  },

  // Confirmation dialogs
  confirm: {
    delete: '确定要删除此项目吗？',
    discard: '确定要舍弃变更吗？',
    leave: '确定要离开吗？您的变更可能不会被储存。',
  },

  // Time and date
  time: {
    now: '刚刚',
    minutesAgo: '{count} 分钟前',
    hoursAgo: '{count} 小时前',
    daysAgo: '{count} 天前',
    today: '今天',
    yesterday: '昨天',
    tomorrow: '明天',
  },

  // Pagination
  pagination: {
    page: '页',
    of: '/',
    itemsPerPage: '每页项目数',
    showingItems: '显示第 {from} 至 {to} 项，共 {total} 项',
    firstPage: '第一页',
    lastPage: '最后一页',
    previousPage: '上一页',
    nextPage: '下一页',
  },

  // Language
  language: {
    title: '语言',
    select: '选择语言',
    en: '英文',
    'zh-Hans': '简体中文',
  },

  // Footer
  footer: {
    copyright: '© {year} 版权所有。',
    termsOfService: '服务条款',
    privacyPolicy: '隐私政策',
    contactUs: '联络我们',
    help: '说明',
  },
};

