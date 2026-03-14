/**
 * Traditional Chinese Shop Messages
 * 
 * Shop frontend specific messages for product browsing,
 * cart, checkout, orders, and customer-facing features.
 */

export const shop = {
  // Navigation
  nav: {
    home: '首頁',
    products: '商品',
    categories: '分類',
    deals: '優惠',
    newArrivals: '新品上市',
    bestsellers: '熱銷商品',
    contact: '聯絡我們',
    help: '幫助',
    cart: '購物車',
    account: '帳戶',
    orders: '訂單',
    wishlist: '願望清單',
    search: '搜尋',
    searchPlaceholder: '搜尋商品...',
  },

  // Home page
  home: {
    hero: {
      badge: '歡迎來到 JIFFOO',
      title: '優質商品，',
      titleLine2: '快速送達',
      subtitle: '探索我們精心挑選的商品系列',
      shopNow: '立即選購',
      startShopping: '開始購物',
    },
    featured: {
      title: '精選商品',
      viewAll: '查看全部',
    },
    categories: {
      badge: '依分類選購',
      title: '瀏覽商品系列',
    },
    whyChooseUs: {
      badge: '為什麼選擇我們',
      title: '為您打造便利體驗',
      subtitle: '優質購物體驗',
      qualityProducts: {
        badge: '品質保證',
        title: '優質商品',
        description: '每件商品都經過精心挑選，並驗證其真實性和品質。',
      },
      fastDelivery: {
        badge: '快速配送',
        title: '快速配送',
        description: '訂單滿 $50 免運費。大多數訂單在 2-3 個工作天內送達。',
      },
      securePayment: {
        badge: '交易安全',
        title: '安全支付',
        description: '您的付款資訊經過加密保護。安心購物。',
      },
    },
    features: {
      badge: '為什麼選擇我們',
      title: '為您打造便利體驗',
      subtitle: '優質購物體驗',
      shipping: {
        badge: '快速配送',
        title: '快速配送',
        description: '訂單滿 $50 免運費。大多數訂單在 2-3 個工作天內送達。',
      },
      secure: {
        badge: '交易安全',
        title: '安全支付',
        description: '您的付款資訊經過加密保護。安心購物。',
      },
      quality: {
        badge: '品質保證',
        title: '優質商品',
        description: '每件商品都經過精心挑選，並驗證其真實性和品質。',
      },
    },
    cta: {
      badge: '開始您的旅程',
      title: '準備好開始購物了嗎？',
      subtitle: '探索我們完整的商品目錄',
      description: '瀏覽我們的商品目錄，找到您喜愛的商品',
      viewAllProducts: '查看所有商品',
      viewProducts: '查看所有商品',
    },
  },

  // Products page
  products: {
    title: '所有商品',
    subtitle: '探索我們完整的優質商品系列',
    showing: '顯示',
    productsCount: '件商品',
    noProducts: '暫無商品',
    loading: '正在載入商品...',
    sort: {
      newest: '最新上架',
      featured: '精選推薦',
      priceLowToHigh: '價格：低至高',
      priceHighToLow: '價格：高至低',
    },
    pagination: {
      previous: '上一頁',
      next: '下一頁',
    },
    view: {
      grid: '網格檢視',
      list: '列表檢視',
    },
  },

  // Product
  product: {
    addToCart: '加入購物車',
    buyNow: '立即購買',
    outOfStock: '缺貨',
    inStock: '有庫存',
    lowStock: '庫存不足',
    quantity: '數量',
    price: '價格',
    originalPrice: '原價',
    discount: '折扣',
    reviews: '評價',
    noReviews: '尚無評價',
    writeReview: '撰寫評價',
    specifications: '規格',
    description: '商品描述',
    relatedProducts: '相關商品',
    sku: '商品編號',
    category: '分類',
    tags: '標籤',
    share: '分享',
    compareAt: '原價',
    saleEnds: '優惠截止',
  },

  // Cart
  cart: {
    title: '購物車',
    empty: '購物車是空的',
    emptyDescription: '添加一些商品開始購物吧',
    continueShopping: '繼續購物',
    subtotal: '小計',
    shipping: '運費',
    shippingFree: '免運費',
    tax: '稅金',
    discount: '折扣',
    total: '總計',
    checkout: '前往結帳',
    remove: '移除',
    update: '更新',
    itemAdded: '已加入購物車',
    itemRemoved: '已從購物車移除',
    addFailed: '加入購物車失敗',
    addedToCart: '已加入購物車',
    updateFailed: '更新購物車失敗',
    removeFailed: '移除商品失敗',
    items: '件商品',
    variant: '規格',
    orderSummary: '訂單摘要',
    selectAll: '全選',
    deselectAll: '取消全選',
    selected: '已選',
    toast: {
      added: '已加入購物車',
      addedDescription: '已加入您的購物車',
      addFailed: '加入失敗',
      removed: '已從購物車移除',
      removedDescription: '已從您的購物車移除',
      updated: '購物車已更新',
      updatedDescription: '購物車已更新',
    },
  },

  // Checkout
  checkout: {
    title: '結帳',
    shipping: {
      title: '運送資訊',
      address: '運送地址',
      method: '運送方式',
    },
    payment: {
      title: '付款資訊',
      method: '付款方式',
    },
    review: {
      title: '訂單確認',
    },
    placeOrder: '提交訂單',
    processing: '處理中...',
    termsNotice: '點擊「提交訂單」即表示您同意我們的服務條款和隱私政策',
    noPaymentMethods: '無可用付款方式',
    installPaymentPlugin: '請安裝付款插件以啟用結帳功能。',
    contactAdmin: '請聯絡管理員配置付款方式。',
  },

  // Orders
  orders: {
    title: '我的訂單',
    empty: '您尚無訂單',
    orderNumber: '訂單編號',
    orderDate: '訂單日期',
    status: '狀態',
    total: '總計',
    viewDetails: '查看詳情',
    trackOrder: '追蹤訂單',
    reorder: '重新訂購',
    cancelOrder: '取消訂單',
    paymentFailed: '付款失敗',
    orderCancelled: '訂單已取消',
    cancelSuccess: '訂單取消成功',
    cancelFailed: '取消失敗',
    confirmCancel: '確定要取消此訂單嗎？',
    fetchFailed: '無法獲取訂單詳情',
    notFound: '找不到訂單',
    notFoundDescription: '您要找的訂單不存在。',
    paymentSessionFailed: '無法建立付款會話',
    paymentRetryFailed: '重試付款失敗',
    statuses: {
      pending: '待處理',
      processing: '處理中',
      shipped: '已出貨',
      delivered: '已送達',
      cancelled: '已取消',
      refunded: '已退款',
    },
  },

  // Auth
  auth: {
    login: {
      title: '登入',
      email: '電子郵件',
      password: '密碼',
      rememberMe: '記住我',
      forgotPassword: '忘記密碼？',
      submit: '登入',
      noAccount: '還沒有帳戶？',
      signUp: '註冊',
      orContinueWith: '或使用以下方式繼續',
      success: '登入成功',
      welcomeBack: '歡迎回來！',
      failed: '登入失敗',
      oauthFailed: 'OAuth 登入失敗',
    },
    register: {
      title: '建立帳戶',
      firstName: '名字',
      lastName: '姓氏',
      email: '電子郵件',
      password: '密碼',
      confirmPassword: '確認密碼',
      agreeTerms: '我同意服務條款和隱私政策',
      submit: '建立帳戶',
      haveAccount: '已有帳戶？',
      signIn: '登入',
      success: '註冊成功',
      welcomeMessage: '歡迎！請使用您的憑證登入。',
      failed: '註冊失敗',
      oauthFailed: 'OAuth 註冊失敗',
      passwordMismatch: '密碼不匹配',
    },
    logout: '登出',
  },

  // Profile
  profile: {
    title: '我的帳戶',
    personalInfo: '個人資料',
    addresses: '地址',
    paymentMethods: '付款方式',
    orderHistory: '訂單記錄',
    settings: {
      title: '設定',
      profileUpdated: '個人資料更新成功',
      profileUpdateFailed: '更新個人資料失敗',
      passwordChanged: '密碼修改成功',
      passwordChangeFailed: '修改密碼失敗',
    },
  },

  // Store Not Found
  storeNotFound: {
    title: '找不到商店',
    description: '您要找的商店不存在或已不再可用。',
  },

  // Contact
  contact: {
    underDevelopment: '功能開發中',
    underDevelopmentDescription: '聯絡表單功能目前正在開發中，請稍後再試。',
  },

  // Recommendations
  recommendations: {
    errorTitle: '無法載入推薦',
    loading: '正在載入推薦...',
    personalizedForYou: '為您推薦',
    popularProducts: '熱門商品',
    personalizedDescription: '根據您的興趣和購物記錄',
    popularDescription: '您可能喜歡的熱門商品',
    frequentlyBoughtTogether: '經常一起購買',
    frequentlyBoughtTogetherDescription: '搭配這些熱門組合完成您的訂單',
    customersAlsoBought: '其他買家也購買了',
    customersAlsoBoughtDescription: '根據其他顧客的購買記錄',
  },

  // Footer
  footer: {
    aboutUs: '關於我們',
    customerService: '客戶服務',
    information: '資訊',
    contactUs: '聯絡我們',
    quickLinks: '快速連結',
    allProducts: '所有商品',
    specialDeals: '特別優惠',
    helpCenter: '幫助中心',
    shippingInfo: '運送資訊',
    returnsExchanges: '退換貨',
    faq: '常見問題',
    contactInfo: '聯絡資訊',
    legal: '法律資訊',
    privacyPolicy: '隱私政策',
    termsOfService: '服務條款',
    cookiePolicy: 'Cookie 政策',
    copyright: '© {year} {brand}. 版權所有。',
    companyDescription: '您值得信賴的線上購物平台，提供優質商品與卓越服務。',
    newsletter: {
      title: '訂閱電子報',
      placeholder: '輸入您的電子郵件',
      subscribe: '訂閱',
    },
  },

  // Header
  header: {
    login: '登入',
    signUp: '註冊',
    logout: '登出',
    profile: '個人資料',
  },

  // Pages
  pages: {
    help: {
      title: '幫助中心',
      subtitle: '今天我們能幫您什麼？',
      searchPlaceholder: '搜尋幫助...',
      popularTopics: '熱門主題',
      contactSupport: '聯絡客服',
    },
    contact: {
      title: '聯絡我們',
      subtitle: '我們很樂意聽取您的意見',
      form: {
        name: '姓名',
        email: '電子郵件',
        subject: '主題',
        message: '訊息',
        submit: '發送訊息',
      },
    },
    privacy: {
      title: '隱私政策',
      lastUpdated: '最後更新：{date}',
    },
    terms: {
      title: '服務條款',
      lastUpdated: '最後更新：{date}',
    },
    notFound: {
      title: '找不到頁面',
      description: '您要找的頁面不存在。',
      backHome: '返回首頁',
    },
    orderSuccess: {
      title: '訂單已成功提交！',
      description: '感謝您的訂購。您將很快收到確認郵件。',
      orderNumber: '訂單編號',
      viewOrder: '查看訂單',
      continueShopping: '繼續購物',
    },
    orderCancelled: {
      title: '訂單已取消',
      description: '您的訂單已被取消。',
      backToOrders: '返回訂單列表',
    },
  },
};

