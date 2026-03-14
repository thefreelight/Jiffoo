/**
 * English Shop Messages
 * 
 * Shop frontend specific messages for product browsing,
 * cart, checkout, orders, and customer-facing features.
 */

export const shop = {
  // Navigation
  nav: {
    home: 'Home',
    products: 'Products',
    categories: 'Categories',
    deals: 'Deals',
    newArrivals: 'New Arrivals',
    bestsellers: 'Bestsellers',
    contact: 'Contact',
    help: 'Help',
    cart: 'Cart',
    account: 'Account',
    orders: 'Orders',
    wishlist: 'Wishlist',
    search: 'Search',
    searchPlaceholder: 'Search products...',
  },

  // Home page
  home: {
    hero: {
      badge: 'WELCOME TO JIFFOO',
      title: 'Quality Products,',
      titleLine2: 'Delivered Fast',
      subtitle: 'DISCOVER OUR CAREFULLY CURATED SELECTION',
      shopNow: 'SHOP NOW',
      startShopping: 'Start Shopping',
    },
    featured: {
      title: 'Featured Products',
      viewAll: 'View All',
    },
    categories: {
      badge: 'SHOP BY CATEGORY',
      title: 'Browse Collections',
    },
    whyChooseUs: {
      badge: 'WHY SHOP WITH US',
      title: 'Built for Your Convenience',
      subtitle: 'PREMIUM SHOPPING EXPERIENCE',
      qualityProducts: {
        badge: 'QUALITY ASSURED',
        title: 'Premium Quality',
        description: 'Every product is carefully selected and verified for authenticity and quality.',
      },
      fastDelivery: {
        badge: 'RAPID SHIPPING',
        title: 'Fast Delivery',
        description: 'Free shipping on orders over $50. Most orders arrive within 2-3 business days.',
      },
      securePayment: {
        badge: 'PROTECTED TRANSACTIONS',
        title: 'Secure Payment',
        description: 'Your payment information is encrypted and secure. Shop with confidence.',
      },
    },
    features: {
      badge: 'WHY SHOP WITH US',
      title: 'Built for Your Convenience',
      subtitle: 'PREMIUM SHOPPING EXPERIENCE',
      shipping: {
        badge: 'RAPID SHIPPING',
        title: 'Fast Delivery',
        description: 'Free shipping on orders over $50. Most orders arrive within 2-3 business days.',
      },
      secure: {
        badge: 'PROTECTED TRANSACTIONS',
        title: 'Secure Payment',
        description: 'Your payment information is encrypted and secure. Shop with confidence.',
      },
      quality: {
        badge: 'QUALITY ASSURED',
        title: 'Premium Quality',
        description: 'Every product is carefully selected and verified for authenticity and quality.',
      },
    },
    cta: {
      badge: 'START YOUR JOURNEY',
      title: 'Ready to Start Shopping?',
      subtitle: 'EXPLORE OUR COMPLETE CATALOG',
      description: 'Browse our product catalog and find what you love',
      viewAllProducts: 'VIEW ALL PRODUCTS',
      viewProducts: 'VIEW ALL PRODUCTS',
    },
  },

  // Products page
  products: {
    title: 'All Products',
    subtitle: 'Discover our complete collection of quality products',
    showing: 'Showing',
    productsCount: 'products',
    noProducts: 'No products available',
    loading: 'Loading products...',
    sort: {
      newest: 'Newest',
      featured: 'Featured',
      priceLowToHigh: 'Price: Low to High',
      priceHighToLow: 'Price: High to Low',
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
    },
    view: {
      grid: 'Grid view',
      list: 'List view',
    },
  },

  // Product
  product: {
    addToCart: 'Add to Cart',
    buyNow: 'Buy Now',
    outOfStock: 'Out of Stock',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    quantity: 'Quantity',
    price: 'Price',
    originalPrice: 'Original Price',
    discount: 'Discount',
    reviews: 'Reviews',
    noReviews: 'No reviews yet',
    writeReview: 'Write a Review',
    specifications: 'Specifications',
    description: 'Description',
    relatedProducts: 'Related Products',
    sku: 'SKU',
    category: 'Category',
    tags: 'Tags',
    share: 'Share',
    compareAt: 'Compare at',
    saleEnds: 'Sale ends',
  },

  // Cart
  cart: {
    title: 'Shopping Cart',
    empty: 'Your cart is empty',
    emptyDescription: 'Add some items to get started',
    continueShopping: 'Continue Shopping',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    shippingFree: 'Free',
    tax: 'Tax',
    discount: 'Discount',
    total: 'Total',
    checkout: 'Proceed to Checkout',
    remove: 'Remove',
    update: 'Update',
    itemAdded: 'Item added to cart',
    itemRemoved: 'Item removed from cart',
    addFailed: 'Failed to add item to cart',
    addedToCart: 'Added to cart',
    updateFailed: 'Failed to update cart',
    removeFailed: 'Failed to remove item',
    items: 'items',
    variant: 'Variant',
    orderSummary: 'Order Summary',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    selected: 'selected',
    toast: {
      added: 'Added to cart',
      addedDescription: 'has been added to your cart',
      addFailed: 'Failed to add',
      removed: 'Removed from cart',
      removedDescription: 'has been removed from your cart',
      updated: 'Cart updated',
      updatedDescription: 'Cart has been updated',
    },
  },

  // Checkout
  checkout: {
    title: 'Checkout',
    shipping: {
      title: 'Shipping Information',
      address: 'Shipping Address',
      method: 'Shipping Method',
    },
    payment: {
      title: 'Payment Information',
      method: 'Payment Method',
    },
    review: {
      title: 'Review Order',
    },
    placeOrder: 'Place Order',
    processing: 'Processing...',
    termsNotice: 'By clicking "Place Order", you agree to our Terms of Service and Privacy Policy',
    noPaymentMethods: 'No Payment Methods Available',
    installPaymentPlugin: 'Please install a payment plugin to enable checkout functionality.',
    contactAdmin: 'Contact your administrator to configure payment methods.',
  },

  // Orders
  orders: {
    title: 'My Orders',
    empty: 'You have no orders yet',
    orderNumber: 'Order #',
    orderDate: 'Order Date',
    status: 'Status',
    total: 'Total',
    viewDetails: 'View Details',
    trackOrder: 'Track Order',
    reorder: 'Reorder',
    cancelOrder: 'Cancel Order',
    paymentFailed: 'Payment failed',
    orderCancelled: 'Order cancelled',
    cancelSuccess: 'Order cancelled successfully',
    cancelFailed: 'Cancel failed',
    confirmCancel: 'Are you sure you want to cancel this order?',
    fetchFailed: 'Failed to fetch order details',
    notFound: 'Order not found',
    notFoundDescription: 'The order you are looking for does not exist.',
    paymentSessionFailed: 'Failed to create payment session',
    paymentRetryFailed: 'Failed to retry payment',
    statuses: {
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    },
  },

  // Auth
  auth: {
    login: {
      title: 'Sign In',
      email: 'Email',
      password: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      submit: 'Sign In',
      noAccount: "Don't have an account?",
      signUp: 'Sign up',
      orContinueWith: 'Or continue with',
      success: 'Login successful',
      welcomeBack: 'Welcome back!',
      failed: 'Login failed',
      oauthFailed: 'OAuth login failed',
    },
    register: {
      title: 'Create Account',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      agreeTerms: 'I agree to the Terms of Service and Privacy Policy',
      submit: 'Create Account',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
      success: 'Registration successful',
      welcomeMessage: 'Welcome! Please log in with your credentials.',
      failed: 'Registration failed',
      oauthFailed: 'OAuth registration failed',
      passwordMismatch: 'Passwords do not match',
    },
    logout: 'Sign Out',
  },

  // Profile
  profile: {
    title: 'My Account',
    personalInfo: 'Personal Information',
    addresses: 'Addresses',
    paymentMethods: 'Payment Methods',
    orderHistory: 'Order History',
    settings: {
      title: 'Settings',
      profileUpdated: 'Profile updated successfully',
      profileUpdateFailed: 'Failed to update profile',
      passwordChanged: 'Password changed successfully',
      passwordChangeFailed: 'Failed to change password',
    },
  },

  // Store Not Found
  storeNotFound: {
    title: 'Store Not Found',
    description: "The store you're looking for doesn't exist or is no longer available.",
  },

  // Contact
  contact: {
    underDevelopment: 'Feature Under Development',
    underDevelopmentDescription: 'The contact form feature is currently under development. Please try again later.',
  },

  // Recommendations
  recommendations: {
    errorTitle: 'Unable to load recommendations',
    loading: 'Loading recommendations...',
    personalizedForYou: 'Recommended For You',
    popularProducts: 'Popular Products',
    personalizedDescription: 'Based on your interests and shopping history',
    popularDescription: 'Trending products you might like',
    frequentlyBoughtTogether: 'Frequently Bought Together',
    frequentlyBoughtTogetherDescription: 'Complete your order with these popular combinations',
    customersAlsoBought: 'Customers Also Bought',
    customersAlsoBoughtDescription: 'Based on what other customers purchased',
  },

  // Footer
  footer: {
    aboutUs: 'About Us',
    customerService: 'Customer Service',
    information: 'Information',
    contactUs: 'Contact Us',
    quickLinks: 'Quick Links',
    allProducts: 'All Products',
    specialDeals: 'Special Deals',
    helpCenter: 'Help Center',
    shippingInfo: 'Shipping Info',
    returnsExchanges: 'Returns & Exchanges',
    faq: 'FAQ',
    contactInfo: 'Contact Info',
    legal: 'Legal',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    cookiePolicy: 'Cookie Policy',
    copyright: '© {year} {brand}. All rights reserved.',
    companyDescription: 'Your trusted e-commerce store for quality products and exceptional service.',
    newsletter: {
      title: 'Subscribe to Newsletter',
      placeholder: 'Enter your email',
      subscribe: 'Subscribe',
    },
  },

  // Header
  header: {
    login: 'Login',
    signUp: 'Sign Up',
    logout: 'Logout',
    profile: 'Profile',
  },

  // Pages
  pages: {
    help: {
      title: 'Help Center',
      subtitle: 'How can we help you today?',
      searchPlaceholder: 'Search for help...',
      popularTopics: 'Popular Topics',
      contactSupport: 'Contact Support',
    },
    contact: {
      title: 'Contact Us',
      subtitle: 'We\'d love to hear from you',
      form: {
        name: 'Name',
        email: 'Email',
        subject: 'Subject',
        message: 'Message',
        submit: 'Send Message',
      },
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: {date}',
    },
    terms: {
      title: 'Terms of Service',
      lastUpdated: 'Last updated: {date}',
    },
    notFound: {
      title: 'Page Not Found',
      description: 'The page you are looking for does not exist.',
      backHome: 'Back to Home',
    },
    orderSuccess: {
      title: 'Order Placed Successfully!',
      description: 'Thank you for your order. You will receive a confirmation email shortly.',
      orderNumber: 'Order Number',
      viewOrder: 'View Order',
      continueShopping: 'Continue Shopping',
    },
    orderCancelled: {
      title: 'Order Cancelled',
      description: 'Your order has been cancelled.',
      backToOrders: 'Back to Orders',
    },
  },
};

