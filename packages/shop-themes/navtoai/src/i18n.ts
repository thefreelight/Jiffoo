export type NavLocale = 'en' | 'zh-Hans' | 'zh-Hant';

export interface NavCategoryShowcase {
  title: string;
  description: string;
  href: string;
  accent: 'blue' | 'purple' | 'orange' | 'teal' | 'yellow' | 'slate' | 'pink' | 'green';
}

export interface NavFeaturedProject {
  name: string;
  vendor: string;
  description: string;
  tags: string[];
  rating: string;
  accent: 'green' | 'purple' | 'slate' | 'blue' | 'cyan' | 'orange' | 'teal' | 'yellow' | 'pink';
}

export interface NavLeaderboardItem {
  rank: string;
  name: string;
  category: string;
  score: string;
}

export interface NavNewsItem {
  title: string;
  summary: string;
  time: string;
  tag: string;
}

export interface NavTagItem {
  label: string;
  accent: 'blue' | 'purple' | 'orange' | 'teal' | 'yellow' | 'pink';
}

export interface NavCopy {
  locale: NavLocale;
  brandTagline: string;
  common: {
    search: string;
    searchPlaceholder: string;
    newest: string;
    price: string;
    name: string;
    page: string;
    addToStack: string;
    openDetail: string;
    free: string;
    reviews: string;
    operatorReady: string;
    featuredPick: string;
    inStock: string;
    queryLabel: string;
    directoryFirst: string;
    listings: string;
    noResults: string;
    signal: string;
    toolsUnit: string;
    curatedBrief: string;
    overview: string;
    browseAll: string;
    loading: string;
  };
  header: {
    submit: string;
    favorites: string;
    auth: string;
    register: string;
    logout: string;
    account: string;
    cart: string;
    menu: string;
    mobileSearchPlaceholder: string;
  };
  sidebar: {
    home: string;
    tools: string;
    apps: string;
    models: string;
    resources: string;
    rankings: string;
    news: string;
    collections: string;
    promoEyebrow: string;
    promoTitle: string;
    promoBody: string;
    promoCta: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    heroSearchPlaceholder: string;
    hotSearches: string;
    categorySection: string;
    featuredSection: string;
    rankingSection: string;
    latestNewsSection: string;
    hotTagsSection: string;
    rankingTabs: [string, string, string];
  };
  catalog: {
    toolsEyebrow: string;
    toolsTitle: string;
    toolsDescription: string;
    toolsSearchPlaceholder: string;
    searchTitle: string;
    searchDescription: string;
    bestsellersEyebrow: string;
    bestsellersTitle: string;
    bestsellersDescription: string;
    newArrivalsEyebrow: string;
    newArrivalsTitle: string;
    newArrivalsDescription: string;
    dealsEyebrow: string;
    dealsTitle: string;
    dealsDescription: string;
  };
  categories: {
    eyebrow: string;
    title: string;
    description: string;
    backHome: string;
    empty: string;
    openCategory: string;
  };
  profile: {
    signInTitle: string;
    signInCta: string;
    back: string;
    profileEyebrow: string;
    profileTitle: string;
    securityEyebrow: string;
    securityTitle: string;
    email: string;
    name: string;
    phone: string;
    dateOfBirth: string;
    preferredLanguage: string;
    timezone: string;
    currentPassword: string;
    newPassword: string;
    saveProfile: string;
    savingProfile: string;
    changePassword: string;
    updatingPassword: string;
  };
  footer: {
    title: string;
    body: string;
    explore: string;
    support: string;
    docs: string;
    contact: string;
    privacy: string;
    terms: string;
    copyright: string;
    summary: string;
    productCol: string;
    resourcesCol: string;
    companyCol: string;
    guides: string;
    aiNews: string;
    newsletter: string;
    about: string;
    apiSoon: string;
    submitTool: string;
    blog: string;
    tagline: string;
    brandLine: string;
  };
  quickSearches: string[];
  categoryCards: NavCategoryShowcase[];
  featuredProjects: NavFeaturedProject[];
  leaderboard: NavLeaderboardItem[];
  newsItems: NavNewsItem[];
  hotTags: NavTagItem[];
  landing: {
    nav: { explore: string; categories: string; trending: string; blog: string; submit: string; signIn: string; getStarted: string };
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    popularSearches: string;
    categorySection: string;
    categorySectionSub: string;
    exploreAll: string;
    featuredTitle: string;
    featuredSub: string;
    viewAllTools: string;
    usersSuffix: string;
    subscribeEyebrow: string;
    subscribeTitle: string;
    subscribeSub: string;
    subscribePlaceholder: string;
    subscribeCta: string;
    subscribePerks: [string, string, string];
    trendingTitle: string;
    trendingSub: string;
    viewTrending: string;
    toolsCountSuffix: string;
  };
}

const enCopy: Omit<NavCopy, 'locale'> = {
  brandTagline: 'Discover, evaluate, and build with the right AI stack.',
  common: {
    search: 'Search',
    searchPlaceholder: 'Search AI tools, e.g. ChatGPT, video, design...',
    newest: 'Newest',
    price: 'Price',
    name: 'Name',
    page: 'Page',
    addToStack: 'Add to stack',
    openDetail: 'Open detail',
    free: 'Free to explore',
    reviews: 'reviews',
    operatorReady: 'Operator-ready listing',
    featuredPick: 'Featured directory pick',
    inStock: 'Ready for immediate checkout',
    queryLabel: 'Query',
    directoryFirst: 'Directory-first experience',
    listings: 'listings',
    noResults: 'No AI projects matched the current filters.',
    signal: 'Signal',
    toolsUnit: 'tools',
    curatedBrief: 'Weekly brief',
    overview: 'Atlas overview',
    browseAll: 'Browse all',
    loading: 'Loading...',
  },
  header: {
    submit: 'Submit Project',
    favorites: 'Favorites',
    auth: 'Login / Register',
    register: 'Create account',
    logout: 'Log out',
    account: 'Account',
    cart: 'Cart',
    menu: 'Menu',
    mobileSearchPlaceholder: 'Search tools, agents, video, coding...',
  },
  sidebar: {
    home: 'Home',
    tools: 'AI Tools',
    apps: 'AI Apps',
    models: 'Model Plaza',
    resources: 'Resources',
    rankings: 'Rankings',
    news: 'News',
    collections: 'Collections',
    promoEyebrow: 'Discover more',
    promoTitle: 'Find the AI that actually fits the workflow.',
    promoBody:
      'NavtoAI turns launch noise into a calmer, clearer navigation experience for serious builders.',
    promoCta: 'Explore now',
  },
  home: {
    eyebrow: 'Curated AI directory',
    title: 'Discover the best AI tools and resources.',
    subtitle: 'Curated AI tools that improve work, sharpen decisions, and keep discovery calm.',
    heroSearchPlaceholder: 'Search AI tools, apps, and topics...',
    hotSearches: 'Hot searches',
    categorySection: 'Popular categories',
    featuredSection: 'Featured picks',
    rankingSection: 'Rankings',
    latestNewsSection: 'Latest news',
    hotTagsSection: 'Hot tags this week',
    rankingTabs: ['Weekly', 'Monthly', 'All time'],
  },
  catalog: {
    toolsEyebrow: 'AI Tool Index',
    toolsTitle: 'Browse AI projects with sharper context and less noise.',
    toolsDescription:
      'Use the directory like a product atlas: filter by workflow, compare quality signals, and jump into detail pages fast.',
    toolsSearchPlaceholder: 'Search chat, coding, image, video, voice...',
    searchTitle: 'Search results shaped for faster AI comparison.',
    searchDescription:
      'Keep the clean directory frame while narrowing the catalog to one model family, use case, or workflow.',
    bestsellersEyebrow: 'Rankings',
    bestsellersTitle: 'The AI projects operators keep coming back to.',
    bestsellersDescription:
      'A tighter leaderboard of proven tools, strong reputations, and repeat buying intent.',
    newArrivalsEyebrow: 'Latest News',
    newArrivalsTitle: 'Fresh AI launches worth reviewing before the feed moves on.',
    newArrivalsDescription:
      'New arrivals stay readable when the design favors category fit and context over noise.',
    dealsEyebrow: 'Collections',
    dealsTitle: 'Curated bundles for teams building an AI stack with discipline.',
    dealsDescription:
      'Collections make it easier to explore high-fit tools without losing the premium directory feel.',
  },
  categories: {
    eyebrow: 'Model Plaza',
    title: 'Browse the catalog by workflow lane and project type.',
    description:
      'Categories help visitors narrow the field before they compare listings, trust signals, and pricing.',
    backHome: 'Back home',
    empty: 'No categories are available yet.',
    openCategory: 'Open category',
  },
  profile: {
    signInTitle: 'Sign in to manage your NavtoAI account.',
    signInCta: 'Sign in',
    back: 'Back',
    profileEyebrow: 'Profile settings',
    profileTitle: 'Keep your discovery workspace ready for the next shortlist.',
    securityEyebrow: 'Security',
    securityTitle: 'Protect access while your team compares tools and resources.',
    email: 'Email',
    name: 'Name',
    phone: 'Phone',
    dateOfBirth: 'Date of birth',
    preferredLanguage: 'Language',
    timezone: 'Timezone',
    currentPassword: 'Current password',
    newPassword: 'New password',
    saveProfile: 'Save profile',
    savingProfile: 'Saving...',
    changePassword: 'Change password',
    updatingPassword: 'Updating...',
  },
  footer: {
    title: 'A premium AI directory with better signals.',
    body:
      'NavtoAI is designed for people who want cleaner discovery, stronger curation, and faster decisions without losing storefront depth.',
    explore: 'Explore',
    support: 'Support',
    docs: 'Documentation',
    contact: 'Contact',
    privacy: 'Privacy',
    terms: 'Terms',
    copyright: 'navtoai.com. All rights reserved.',
    summary: 'Made for multilingual AI discovery, editorial curation, and commerce-ready evaluation.',
    productCol: 'Product',
    resourcesCol: 'Resources',
    companyCol: 'Company',
    guides: 'Guides',
    aiNews: 'AI News',
    newsletter: 'Newsletter',
    about: 'About us',
    apiSoon: 'API (Soon)',
    submitTool: 'Submit a tool',
    blog: 'Blog',
    tagline: 'Navigate the AI world. Discover. Learn. Create. Together.',
    brandLine: 'A more creative tomorrow, together.',
  },
  quickSearches: ['ChatGPT', 'Midjourney', 'Claude', 'Notion AI', 'Runway', 'Perplexity'],
  categoryCards: [
    {
      title: 'Chatbots',
      description: 'General copilots, AI assistants, and chat workflows.',
      href: '/search?q=chat',
      accent: 'blue',
    },
    {
      title: 'Image & Design',
      description: 'AI drawing, branding, mockups, and visual ideation.',
      href: '/search?q=image',
      accent: 'purple',
    },
    {
      title: 'Video',
      description: 'Video generation, editing, motion graphics, and clips.',
      href: '/search?q=video',
      accent: 'orange',
    },
    {
      title: 'Writing',
      description: 'Content drafting, summarization, and productivity writing.',
      href: '/search?q=writing',
      accent: 'teal',
    },
    {
      title: 'Productivity',
      description: 'Notes, knowledge, automation, and workflow tools.',
      href: '/search?q=productivity',
      accent: 'yellow',
    },
    {
      title: 'Development',
      description: 'Code copilots, IDEs, agents, and shipping tools.',
      href: '/search?q=coding',
      accent: 'pink',
    },
    {
      title: 'Marketing',
      description: 'SEO, ads, social, and growth automation.',
      href: '/search?q=marketing',
      accent: 'green',
    },
    {
      title: 'More',
      description: 'Explore the full catalog of AI models, apps, and resources.',
      href: '/categories',
      accent: 'slate',
    },
  ],
  featuredProjects: [
    {
      name: 'ChatGPT',
      vendor: 'OpenAI',
      description: 'A versatile AI assistant for work, learning and creativity.',
      tags: ['Chatbot'],
      rating: '4.9',
      accent: 'green',
    },
    {
      name: 'Midjourney',
      vendor: 'Midjourney',
      description: 'Create stunning images from text with AI.',
      tags: ['Image Generation'],
      rating: '4.8',
      accent: 'purple',
    },
    {
      name: 'Claude',
      vendor: 'Anthropic',
      description: 'A thoughtful AI assistant for complex tasks.',
      tags: ['Chatbot'],
      rating: '4.7',
      accent: 'orange',
    },
    {
      name: 'Notion AI',
      vendor: 'Notion',
      description: 'Write, plan, and organize with AI inside Notion.',
      tags: ['Productivity'],
      rating: '4.6',
      accent: 'slate',
    },
    {
      name: 'Runway',
      vendor: 'Runway',
      description: 'AI video creation for creatives.',
      tags: ['Video'],
      rating: '4.6',
      accent: 'blue',
    },
    {
      name: 'Perplexity',
      vendor: 'Perplexity AI',
      description: 'Search the web with AI, get real answers.',
      tags: ['Search'],
      rating: '4.7',
      accent: 'cyan',
    },
  ],
  leaderboard: [
    { rank: '1', name: 'ChatGPT', category: 'Conversational AI', score: '5.0' },
    { rank: '2', name: 'Midjourney', category: 'Image Generation', score: '4.9' },
    { rank: '3', name: 'Notion AI', category: 'Writing Assistant', score: '4.8' },
  ],
  newsItems: [
    {
      title: 'OpenAI ships GPT-4o updates with better multimodal responses',
      summary: 'A new round of quality improvements sharpens voice, image, and live assistant flows.',
      time: '2h ago',
      tag: 'Model updates',
    },
    {
      title: 'Midjourney unveils a cleaner V6 image pipeline',
      summary: 'Sharper prompt handling and stronger texture fidelity push image quality higher.',
      time: '5h ago',
      tag: 'Image tools',
    },
    {
      title: 'Sora keeps accelerating AI-native video production',
      summary: 'Teams are using text-driven video generation to prototype faster visual narratives.',
      time: '1d ago',
      tag: 'Video creation',
    },
  ],
  hotTags: [
    { label: 'Chat assistants', accent: 'blue' },
    { label: 'Image generation', accent: 'purple' },
    { label: 'Video creation', accent: 'orange' },
    { label: 'Coding tools', accent: 'teal' },
    { label: 'Writing helper', accent: 'yellow' },
    { label: 'Productivity', accent: 'pink' },
  ],
  landing: {
    nav: { explore: 'Explore', categories: 'Categories', trending: 'Trending', blog: 'Blog', submit: 'Submit', signIn: 'Sign in', getStarted: 'Get started' },
    heroEyebrow: 'Your guide to the AI world',
    heroTitle: 'Navigate\nthe AI future.',
    heroSubtitle: 'Discover the best AI tools, resources and ideas. Everything you need to work smarter, create faster, and explore what’s next — all in one place.',
    popularSearches: 'Popular searches:',
    categorySection: 'Browse by category',
    categorySectionSub: 'Every corner of the AI universe, curated.',
    exploreAll: 'Explore all',
    featuredTitle: 'Featured Tools',
    featuredSub: 'Hand-picked AI tools to supercharge your productivity.',
    viewAllTools: 'View all tools',
    usersSuffix: 'users',
    subscribeEyebrow: 'Join 50,000+ AI explorers',
    subscribeTitle: 'Stay ahead with the best AI tools.',
    subscribeSub: 'Get the latest tools, trends and guides delivered to your inbox.',
    subscribePlaceholder: 'Enter your email',
    subscribeCta: 'Subscribe',
    subscribePerks: ['Weekly updates', 'No spam', 'Unsubscribe anytime'],
    trendingTitle: 'Trending This Week',
    trendingSub: 'The hottest AI tools right now.',
    viewTrending: 'View trending',
    toolsCountSuffix: 'tools',
  },
};

const zhHansCopy: Omit<NavCopy, 'locale'> = {
  brandTagline: '发现、评估并搭建真正适合你的 AI 工具栈。',
  common: {
    search: '搜索',
    searchPlaceholder: '搜索 AI 工具，例如 ChatGPT、视频、设计...',
    newest: '最新',
    price: '价格',
    name: '名称',
    page: '第',
    addToStack: '加入清单',
    openDetail: '查看详情',
    free: '免费体验',
    reviews: '条评价',
    operatorReady: '可直接用于业务评估',
    featuredPick: '精选推荐',
    inStock: '可立即下单',
    queryLabel: '关键词',
    directoryFirst: '目录式体验',
    listings: '个项目',
    noResults: '当前筛选条件下没有匹配的 AI 项目。',
    signal: '信号',
    toolsUnit: '个工具',
    curatedBrief: '本周简报',
    overview: '导航概览',
    browseAll: '查看全部',
    loading: '加载中...',
  },
  header: {
    submit: '提交项目',
    favorites: '收藏夹',
    auth: '登录 / 注册',
    register: '创建账户',
    logout: '退出登录',
    account: '我的账户',
    cart: '购物车',
    menu: '菜单',
    mobileSearchPlaceholder: '搜索工具、Agent、视频、编程...',
  },
  sidebar: {
    home: '首页',
    tools: 'AI 工具',
    apps: 'AI 应用',
    models: '模型广场',
    resources: '资源教程',
    rankings: '排行榜',
    news: '资讯动态',
    collections: '专题合集',
    promoEyebrow: '发现更多',
    promoTitle: '找到真正适合工作流的 AI 项目。',
    promoBody: 'NavtoAI 把爆款噪音整理成更清晰、更高级的探索体验。',
    promoCta: '探索更多',
  },
  home: {
    eyebrow: '精选 AI 导航站',
    title: '发现全球最好的 AI 工具和资源',
    subtitle: '精选优质 AI 工具，提升效率，激发创意。',
    heroSearchPlaceholder: '搜索 AI 工具、应用或关联关键词...',
    hotSearches: '热门搜索',
    categorySection: '热门分类',
    featuredSection: '热门推荐',
    rankingSection: '排行榜',
    latestNewsSection: '最新资讯',
    hotTagsSection: '本周热门标签',
    rankingTabs: ['周榜', '月榜', '总榜'],
  },
  catalog: {
    toolsEyebrow: 'AI 工具目录',
    toolsTitle: '用更清晰的上下文浏览 AI 项目，而不是被噪音淹没。',
    toolsDescription: '像看一份 AI 项目地图一样浏览目录，按工作流筛选、对比质量信号，并快速进入详情页。',
    toolsSearchPlaceholder: '搜索对话、编程、绘图、视频、语音...',
    searchTitle: '为 AI 对比而优化的搜索结果',
    searchDescription: '保留目录式结构，同时把结果收窄到具体模型、工作流或使用场景。',
    bestsellersEyebrow: '排行榜',
    bestsellersTitle: '用户持续回访的 AI 项目',
    bestsellersDescription: '把真正被反复使用、口碑稳定、转化明确的项目集中展示。',
    newArrivalsEyebrow: '最新资讯',
    newArrivalsTitle: '值得在热度过去前认真看一眼的新 AI 项目',
    newArrivalsDescription: '新项目不该只是刷屏，它们应该被放在更容易判断的上下文里。',
    dealsEyebrow: '专题合集',
    dealsTitle: '为团队搭建 AI 工具栈准备的精选合集',
    dealsDescription: '让高匹配度的项目更容易被打包探索，同时保留高级目录站的气质。',
  },
  categories: {
    eyebrow: '模型广场',
    title: '按工作流与项目类型浏览整站目录',
    description: '分类页帮助访问者先缩小范围，再进一步比较项目详情、口碑信号与价格。',
    backHome: '返回首页',
    empty: '暂时还没有可展示的分类。',
    openCategory: '进入分类',
  },
  profile: {
    signInTitle: '登录后管理你的 NavtoAI 账户。',
    signInCta: '立即登录',
    back: '返回',
    profileEyebrow: '资料设置',
    profileTitle: '让你的探索工作区随时为下一轮筛选做好准备。',
    securityEyebrow: '安全设置',
    securityTitle: '在你和团队对比 AI 项目时，保护账户访问安全。',
    email: '邮箱',
    name: '名称',
    phone: '手机号',
    dateOfBirth: '出生日期',
    preferredLanguage: '语言偏好',
    timezone: '时区',
    currentPassword: '当前密码',
    newPassword: '新密码',
    saveProfile: '保存资料',
    savingProfile: '保存中...',
    changePassword: '修改密码',
    updatingPassword: '更新中...',
  },
  footer: {
    title: '更懂筛选信号的 AI 导航站',
    body: 'NavtoAI 面向想要更好探索、更强策展和更快做决定的用户，同时保留完整的商城能力。',
    explore: '探索',
    support: '支持',
    docs: '文档',
    contact: '联系我们',
    privacy: '隐私政策',
    terms: '服务条款',
    copyright: 'navtoai.com. All rights reserved.',
    summary: '适用于多语言 AI 导航、编辑型策展与可下单评估流程。',
    productCol: '产品',
    resourcesCol: '资源',
    companyCol: '公司',
    guides: '指南',
    aiNews: 'AI 资讯',
    newsletter: '订阅邮件',
    about: '关于我们',
    apiSoon: 'API（即将推出）',
    submitTool: '提交工具',
    blog: '博客',
    tagline: '驾驭 AI 世界。发现、学习、创造，同行。',
    brandLine: '更富创意的明天，与你同行。',
  },
  quickSearches: ['ChatGPT', 'Midjourney', 'Claude', 'Notion AI', 'Runway', 'Perplexity'],
  categoryCards: [
    {
      title: '对话聊天',
      description: '通用助手、AI 搜索与对话式工作流。',
      href: '/search?q=chat',
      accent: 'blue',
    },
    {
      title: '图像设计',
      description: 'AI 绘图、品牌视觉、海报与设计灵感工具。',
      href: '/search?q=image',
      accent: 'purple',
    },
    {
      title: '视频创作',
      description: '视频生成、剪辑、动效与短片创作。',
      href: '/search?q=video',
      accent: 'orange',
    },
    {
      title: '写作助手',
      description: '内容起草、摘要与生产力写作。',
      href: '/search?q=writing',
      accent: 'teal',
    },
    {
      title: '效率办公',
      description: '笔记、知识库、自动化与工作流工具。',
      href: '/search?q=productivity',
      accent: 'yellow',
    },
    {
      title: '代码开发',
      description: '编程助手、IDE、Agent 与交付工具。',
      href: '/search?q=coding',
      accent: 'pink',
    },
    {
      title: '市场营销',
      description: 'SEO、广告、社媒与增长自动化。',
      href: '/search?q=marketing',
      accent: 'green',
    },
    {
      title: '更多分类',
      description: '探索全部 AI 模型、应用与资源。',
      href: '/categories',
      accent: 'slate',
    },
  ],
  featuredProjects: [
    {
      name: 'ChatGPT',
      vendor: 'OpenAI',
      description: '面向工作、学习与创作的通用 AI 助手。',
      tags: ['对话聊天'],
      rating: '4.9',
      accent: 'green',
    },
    {
      name: 'Midjourney',
      vendor: 'Midjourney',
      description: '用 AI 从文字创作惊艳图像。',
      tags: ['图像生成'],
      rating: '4.8',
      accent: 'purple',
    },
    {
      name: 'Claude',
      vendor: 'Anthropic',
      description: '善于处理复杂任务的思考型 AI 助手。',
      tags: ['对话聊天'],
      rating: '4.7',
      accent: 'orange',
    },
    {
      name: 'Notion AI',
      vendor: 'Notion',
      description: '在 Notion 里用 AI 写作、规划与整理。',
      tags: ['效率办公'],
      rating: '4.6',
      accent: 'slate',
    },
    {
      name: 'Runway',
      vendor: 'Runway',
      description: '面向创作者的 AI 视频生成。',
      tags: ['视频创作'],
      rating: '4.6',
      accent: 'blue',
    },
    {
      name: 'Perplexity',
      vendor: 'Perplexity AI',
      description: '用 AI 搜索网页，获得真实答案。',
      tags: ['搜索引擎'],
      rating: '4.7',
      accent: 'cyan',
    },
  ],
  leaderboard: [
    { rank: '1', name: 'ChatGPT', category: '对话聊天', score: '5.0' },
    { rank: '2', name: 'Midjourney', category: '图像生成', score: '4.9' },
    { rank: '3', name: 'Notion AI', category: '写作助手', score: '4.8' },
  ],
  newsItems: [
    {
      title: 'OpenAI 发布 GPT-4o 新能力，响应更快、更自然',
      summary: '新一轮多模态体验升级，进一步改善语音、图像与实时助手流程。',
      time: '2 小时前',
      tag: '模型更新',
    },
    {
      title: 'Midjourney 升级图像管线，细节表现更稳定',
      summary: '提示词理解与材质质感进一步增强，图像质量继续提升。',
      time: '5 小时前',
      tag: '图像工具',
    },
    {
      title: 'Sora 持续推动 AI 视频创作进入更成熟阶段',
      summary: '越来越多团队开始用文本生成视频做原型与视觉叙事探索。',
      time: '1 天前',
      tag: '视频创作',
    },
  ],
  hotTags: [
    { label: '对话聊天', accent: 'blue' },
    { label: '图像生成', accent: 'purple' },
    { label: '视频创作', accent: 'orange' },
    { label: '代码开发', accent: 'teal' },
    { label: '写作助手', accent: 'yellow' },
    { label: '生产力', accent: 'pink' },
  ],
  landing: {
    nav: { explore: '发现', categories: '分类', trending: '热门趋势', blog: '博客', submit: '提交', signIn: '登录', getStarted: '立即开始' },
    heroEyebrow: '你的 AI 世界向导',
    heroTitle: '驾驭 AI 的未来。',
    heroSubtitle: '发现最好的 AI 工具、资源与灵感。更聪明地工作、更快速地创造、探索下一个风口——尽在一处。',
    popularSearches: '热门搜索：',
    categorySection: '按分类浏览',
    categorySectionSub: 'AI 世界的每个角落，都为你精选。',
    exploreAll: '探索全部',
    featuredTitle: '精选工具',
    featuredSub: '人工精选的 AI 工具，为你的生产力加速。',
    viewAllTools: '查看全部工具',
    usersSuffix: '用户',
    subscribeEyebrow: '加入 50,000+ AI 探索者',
    subscribeTitle: '与最好的 AI 工具保持同步。',
    subscribeSub: '最新工具、趋势与指南，直达你的邮箱。',
    subscribePlaceholder: '输入你的邮箱',
    subscribeCta: '订阅',
    subscribePerks: ['每周更新', '拒绝垃圾邮件', '随时退订'],
    trendingTitle: '本周热门',
    trendingSub: '此刻最火的 AI 工具。',
    viewTrending: '查看热门',
    toolsCountSuffix: '款工具',
  },
};

const zhHantCopy: Omit<NavCopy, 'locale'> = {
  brandTagline: '發現、評估並建立真正適合你的 AI 工具棧。',
  common: {
    search: '搜尋',
    searchPlaceholder: '搜尋 AI 工具，例如 ChatGPT、影片、設計...',
    newest: '最新',
    price: '價格',
    name: '名稱',
    page: '第',
    addToStack: '加入清單',
    openDetail: '查看詳情',
    free: '免費體驗',
    reviews: '則評價',
    operatorReady: '可直接用於業務評估',
    featuredPick: '精選推薦',
    inStock: '可立即下單',
    queryLabel: '關鍵字',
    directoryFirst: '目錄式體驗',
    listings: '個項目',
    noResults: '目前篩選條件下沒有匹配的 AI 項目。',
    signal: '信號',
    toolsUnit: '個工具',
    curatedBrief: '本週簡報',
    overview: '導航概覽',
    browseAll: '查看全部',
    loading: '載入中...',
  },
  header: {
    submit: '提交項目',
    favorites: '收藏夾',
    auth: '登入 / 註冊',
    register: '建立帳戶',
    logout: '登出',
    account: '我的帳戶',
    cart: '購物車',
    menu: '選單',
    mobileSearchPlaceholder: '搜尋工具、Agent、影片、程式開發...',
  },
  sidebar: {
    home: '首頁',
    tools: 'AI 工具',
    apps: 'AI 應用',
    models: '模型廣場',
    resources: '資源教學',
    rankings: '排行榜',
    news: '資訊動態',
    collections: '專題合集',
    promoEyebrow: '發現更多',
    promoTitle: '找到真正適合工作流的 AI 項目。',
    promoBody: 'NavtoAI 把爆款噪音整理成更清晰、更高級的探索體驗。',
    promoCta: '探索更多',
  },
  home: {
    eyebrow: '精選 AI 導航站',
    title: '發現全球最好的 AI 工具和資源',
    subtitle: '精選優質 AI 工具，提升效率，激發創意。',
    heroSearchPlaceholder: '搜尋 AI 工具、應用或關聯關鍵字...',
    hotSearches: '熱門搜尋',
    categorySection: '熱門分類',
    featuredSection: '熱門推薦',
    rankingSection: '排行榜',
    latestNewsSection: '最新資訊',
    hotTagsSection: '本週熱門標籤',
    rankingTabs: ['週榜', '月榜', '總榜'],
  },
  catalog: {
    toolsEyebrow: 'AI 工具目錄',
    toolsTitle: '用更清楚的上下文瀏覽 AI 項目，而不是被噪音淹沒。',
    toolsDescription: '像看一份 AI 項目地圖一樣瀏覽目錄，按工作流篩選、比較品質信號，並快速進入詳情頁。',
    toolsSearchPlaceholder: '搜尋對話、程式開發、繪圖、影片、語音...',
    searchTitle: '為 AI 對比而優化的搜尋結果',
    searchDescription: '保留目錄式結構，同時把結果收斂到具體模型、工作流或使用場景。',
    bestsellersEyebrow: '排行榜',
    bestsellersTitle: '使用者持續回訪的 AI 項目',
    bestsellersDescription: '把真正被反覆使用、口碑穩定、轉化明確的項目集中呈現。',
    newArrivalsEyebrow: '最新資訊',
    newArrivalsTitle: '值得在熱度過去前認真看一眼的新 AI 項目',
    newArrivalsDescription: '新項目不該只是刷屏，它們應該被放在更容易判斷的上下文裡。',
    dealsEyebrow: '專題合集',
    dealsTitle: '為團隊建立 AI 工具棧準備的精選合集',
    dealsDescription: '讓高匹配度的項目更容易被打包探索，同時保留高級目錄站的氣質。',
  },
  categories: {
    eyebrow: '模型廣場',
    title: '按工作流與項目類型瀏覽整站目錄',
    description: '分類頁幫助訪客先縮小範圍，再進一步比較項目詳情、口碑信號與價格。',
    backHome: '返回首頁',
    empty: '暫時還沒有可展示的分類。',
    openCategory: '進入分類',
  },
  profile: {
    signInTitle: '登入後管理你的 NavtoAI 帳戶。',
    signInCta: '立即登入',
    back: '返回',
    profileEyebrow: '資料設定',
    profileTitle: '讓你的探索工作區隨時為下一輪篩選做好準備。',
    securityEyebrow: '安全設定',
    securityTitle: '在你和團隊比較 AI 項目時，保護帳戶存取安全。',
    email: '電子郵件',
    name: '名稱',
    phone: '手機號碼',
    dateOfBirth: '出生日期',
    preferredLanguage: '語言偏好',
    timezone: '時區',
    currentPassword: '目前密碼',
    newPassword: '新密碼',
    saveProfile: '儲存資料',
    savingProfile: '儲存中...',
    changePassword: '修改密碼',
    updatingPassword: '更新中...',
  },
  footer: {
    title: '更懂篩選信號的 AI 導航站',
    body: 'NavtoAI 面向想要更好探索、更強策展與更快做決策的使用者，同時保留完整的商城能力。',
    explore: '探索',
    support: '支援',
    docs: '文件',
    contact: '聯絡我們',
    privacy: '隱私政策',
    terms: '服務條款',
    copyright: 'navtoai.com. All rights reserved.',
    summary: '適用於多語言 AI 導航、編輯型策展與可下單評估流程。',
    productCol: '產品',
    resourcesCol: '資源',
    companyCol: '公司',
    guides: '指南',
    aiNews: 'AI 資訊',
    newsletter: '訂閱郵件',
    about: '關於我們',
    apiSoon: 'API（即將推出）',
    submitTool: '提交工具',
    blog: '部落格',
    tagline: '駕馭 AI 世界。發現、學習、創造，同行。',
    brandLine: '更富創意的明天，與你同行。',
  },
  quickSearches: ['ChatGPT', 'Midjourney', 'Claude', 'Notion AI', 'Runway', 'Perplexity'],
  categoryCards: [
    {
      title: '對話聊天',
      description: '通用助手、AI 搜尋與對話式工作流。',
      href: '/search?q=chat',
      accent: 'blue',
    },
    {
      title: '圖像設計',
      description: 'AI 繪圖、品牌視覺、海報與設計靈感工具。',
      href: '/search?q=image',
      accent: 'purple',
    },
    {
      title: '影片創作',
      description: '影片生成、剪輯、動效與短片創作。',
      href: '/search?q=video',
      accent: 'orange',
    },
    {
      title: '寫作助手',
      description: '內容起草、摘要與生產力寫作。',
      href: '/search?q=writing',
      accent: 'teal',
    },
    {
      title: '效率辦公',
      description: '筆記、知識庫、自動化與工作流工具。',
      href: '/search?q=productivity',
      accent: 'yellow',
    },
    {
      title: '程式開發',
      description: '程式助手、IDE、Agent 與交付工具。',
      href: '/search?q=coding',
      accent: 'pink',
    },
    {
      title: '行銷推廣',
      description: 'SEO、廣告、社群與成長自動化。',
      href: '/search?q=marketing',
      accent: 'green',
    },
    {
      title: '更多分類',
      description: '探索全部 AI 模型、應用與資源。',
      href: '/categories',
      accent: 'slate',
    },
  ],
  featuredProjects: [
    {
      name: 'ChatGPT',
      vendor: 'OpenAI',
      description: '面向工作、學習與創作的通用 AI 助手。',
      tags: ['對話聊天'],
      rating: '4.9',
      accent: 'green',
    },
    {
      name: 'Midjourney',
      vendor: 'Midjourney',
      description: '用 AI 從文字創作驚豔圖像。',
      tags: ['圖像生成'],
      rating: '4.8',
      accent: 'purple',
    },
    {
      name: 'Claude',
      vendor: 'Anthropic',
      description: '善於處理複雜任務的思考型 AI 助手。',
      tags: ['對話聊天'],
      rating: '4.7',
      accent: 'orange',
    },
    {
      name: 'Notion AI',
      vendor: 'Notion',
      description: '在 Notion 裡用 AI 寫作、規劃與整理。',
      tags: ['效率辦公'],
      rating: '4.6',
      accent: 'slate',
    },
    {
      name: 'Runway',
      vendor: 'Runway',
      description: '面向創作者的 AI 影片生成。',
      tags: ['影片創作'],
      rating: '4.6',
      accent: 'blue',
    },
    {
      name: 'Perplexity',
      vendor: 'Perplexity AI',
      description: '用 AI 搜尋網頁，獲得真實答案。',
      tags: ['搜尋引擎'],
      rating: '4.7',
      accent: 'cyan',
    },
  ],
  leaderboard: [
    { rank: '1', name: 'ChatGPT', category: '對話聊天', score: '5.0' },
    { rank: '2', name: 'Midjourney', category: '圖像生成', score: '4.9' },
    { rank: '3', name: 'Notion AI', category: '寫作助手', score: '4.8' },
  ],
  newsItems: [
    {
      title: 'OpenAI 發布 GPT-4o 新能力，回應更快、更自然',
      summary: '新一輪多模態體驗升級，進一步改善語音、圖像與即時助手流程。',
      time: '2 小時前',
      tag: '模型更新',
    },
    {
      title: 'Midjourney 升級圖像流程，細節表現更穩定',
      summary: '提示詞理解與材質表現進一步增強，整體圖像品質持續提升。',
      time: '5 小時前',
      tag: '圖像工具',
    },
    {
      title: 'Sora 持續推動 AI 影片創作走向成熟',
      summary: '越來越多團隊開始用文字生成影片做原型與視覺敘事探索。',
      time: '1 天前',
      tag: '影片創作',
    },
  ],
  hotTags: [
    { label: '對話聊天', accent: 'blue' },
    { label: '圖像生成', accent: 'purple' },
    { label: '影片創作', accent: 'orange' },
    { label: '程式開發', accent: 'teal' },
    { label: '寫作助手', accent: 'yellow' },
    { label: '生產力', accent: 'pink' },
  ],
  landing: {
    nav: { explore: '發現', categories: '分類', trending: '熱門趨勢', blog: '部落格', submit: '提交', signIn: '登入', getStarted: '立即開始' },
    heroEyebrow: '你的 AI 世界嚮導',
    heroTitle: '駕馭 AI 的未來。',
    heroSubtitle: '發現最好的 AI 工具、資源與靈感。更聰明地工作、更快速地創造、探索下一個風口——盡在一處。',
    popularSearches: '熱門搜尋：',
    categorySection: '依分類瀏覽',
    categorySectionSub: 'AI 世界的每個角落，都為你精選。',
    exploreAll: '探索全部',
    featuredTitle: '精選工具',
    featuredSub: '人工精選的 AI 工具，為你的生產力加速。',
    viewAllTools: '檢視全部工具',
    usersSuffix: '用戶',
    subscribeEyebrow: '加入 50,000+ AI 探索者',
    subscribeTitle: '與最好的 AI 工具保持同步。',
    subscribeSub: '最新工具、趨勢與指南，直達你的信箱。',
    subscribePlaceholder: '輸入你的信箱',
    subscribeCta: '訂閱',
    subscribePerks: ['每週更新', '拒絕垃圾郵件', '隨時退訂'],
    trendingTitle: '本週熱門',
    trendingSub: '此刻最紅的 AI 工具。',
    viewTrending: '檢視熱門',
    toolsCountSuffix: '款工具',
  },
};

export function resolveNavLocale(locale?: string | null): NavLocale {
  const normalized = locale?.trim().toLowerCase() || '';

  if (normalized.startsWith('zh')) {
    if (
      normalized.includes('hant') ||
      normalized.includes('tw') ||
      normalized.includes('hk') ||
      normalized.includes('mo')
    ) {
      return 'zh-Hant';
    }

    return 'zh-Hans';
  }

  return 'en';
}

export function getNavCopy(locale?: string | null): NavCopy {
  const resolvedLocale = resolveNavLocale(locale);

  if (resolvedLocale === 'zh-Hans') {
    return { locale: resolvedLocale, ...zhHansCopy };
  }

  if (resolvedLocale === 'zh-Hant') {
    return { locale: resolvedLocale, ...zhHantCopy };
  }

  return { locale: resolvedLocale, ...enCopy };
}
