/**
 * English Common Messages
 * 
 * Cross-application common messages including buttons, system prompts,
 * error states, and other shared UI text.
 */

export const common = {
  // Direct access keys
  noData: 'No data available',
  loading: 'Loading...',
  redirecting: 'Redirecting...',
  unknown: 'Unknown',
  cancel: 'Cancel',

  // Actions
  actions: {
    save: 'Save',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    edit: 'Edit',
    update: 'Update',
    delete: 'Delete',
    view: 'View',
    search: 'Search',
    create: 'Create',
    add: 'Add',
    remove: 'Remove',
    confirm: 'Confirm',
    submit: 'Submit',
    reset: 'Reset',
    clear: 'Clear',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    refresh: 'Refresh',
    retry: 'Retry',
    loading: 'Loading...',
    saving: 'Saving...',
    processing: 'Processing...',
    apply: 'Apply',
    filter: 'Filter',
    sort: 'Sort',
    export: 'Export',
    import: 'Import',
    download: 'Download',
    upload: 'Upload',
    uploading: 'Uploading...',
    copy: 'Copy',
    share: 'Share',
    print: 'Print',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    goHome: 'Go Home',
    continueShopping: 'Continue Shopping',
    configure: 'Configure',
    manage: 'Manage',
    viewDetails: 'View details',
  },

  // Status
  status: {
    loading: 'Loading',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    active: 'Active',
    inactive: 'Inactive',
    enabled: 'Enabled',
    disabled: 'Disabled',
    shipped: 'Shipped',
    delivered: 'Delivered',
    live: 'Live metric',
  },

  // Labels
  labels: {
    all: 'All',
    pages: 'PAGES',
    more: 'MORE',
    file: 'File',
    by: 'by',
    builtin: 'Built-in',
    groups: 'Groups',
    reviews: 'Reviews',
    analytics: 'Analytics',
    salesReport: 'Sales Report',
    overview: 'Overview',
    authentication: 'Authentication',
    utility: 'Utility',
    finance: 'Finance',
  },

  // Common messages
  messages: {
    saveSuccess: 'Saved successfully',
    saveFailed: 'Failed to save changes',
    loading: 'Loading...',
  },

  // Validation
  validation: {
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    invalidPhone: 'Please enter a valid phone number',
    invalidUrl: 'Please enter a valid URL',
    minLength: 'Must be at least {min} characters',
    maxLength: 'Must be no more than {max} characters',
    passwordMismatch: 'Passwords do not match',
    invalidFormat: 'Invalid format',
  },

  // Error messages
  // Shell chrome: heard by screen readers, seen on keyboard focus or when the network drops.
  shell: {
    skipToMain: 'Skip to main content',
    offline: 'You are currently offline. Some features may be unavailable.',
    backOnline: 'Network restored',
    dismissNotice: 'Dismiss notice',
    openMenu: 'Open menu',
    updateAvailable: 'Update available',
  },
  errors: {
    general: 'Something went wrong. Please try again.',
    notFound: 'Not found',
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    serverError: 'Server error. Please try again later.',
    networkError: 'Network error. Please check your connection.',
    rateLimited: 'Too many requests. Please try again later.',
    timeout: 'Request timed out. Please try again.',
    unknown: 'An unknown error occurred',
    themeUnavailable: 'Theme Component Unavailable',
    componentUnavailable: 'Unable to load component',
    cartUnavailable: 'Unable to load cart component',
    productsUnavailable: 'Unable to load products component',
    checkoutUnavailable: 'Unable to load checkout component',
    validation: 'Validation Error',
    tryAgain: 'Please try again',
    error: 'Error',
    loginUnavailable: 'The sign-in form could not be loaded. Please try again.',
  },

  // Empty states
  empty: {
    noData: 'No data available',
    noResults: 'No results found',
    noItems: 'No items',
  },

  // Confirmation dialogs
  confirm: {
    delete: 'Are you sure you want to delete this item?',
    discard: 'Are you sure you want to discard your changes?',
    leave: 'Are you sure you want to leave? Your changes may not be saved.',
  },

  // Time and date
  time: {
    now: 'Just now',
    minutesAgo: '{count} minutes ago',
    hoursAgo: '{count} hours ago',
    daysAgo: '{count} days ago',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
  },

  // Pagination
  pagination: {
    page: 'Page',
    of: 'of',
    itemsPerPage: 'Items per page',
    showingItems: 'Showing {from} to {to} of {total} items',
    firstPage: 'First page',
    lastPage: 'Last page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pagination: 'Pagination',
  },

  // Language
  language: {
    title: 'Language',
    select: 'Select language',
    en: 'English',
    'zh-Hans': 'Simplified Chinese',
    'zh-Hant': 'Traditional Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    changeLanguage: 'Change language',
  },

  // Footer
  footer: {
    copyright: '© {year} All rights reserved.',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    contactUs: 'Contact Us',
    help: 'Help',
  },
  refresh: 'Refresh',
  retry: 'Retry',
  save: 'Save Changes',
  saving: 'Saving...',
  dialog: {
    close: 'Close',
  },
  errorPage: {
    errorId: 'Error ID:',
  },
  globalError: {
    retry: 'Try again',
    title: 'Something went wrong!',
  },
  notFound: {
    goBackHome: 'Go back home',
    pageNotFound: 'Page Not Found',
    sorryThePageYouAreLooking: 'Sorry, the page you are looking for does not exist.',
  },
  state: {
    back: 'Back',
    errorDetailsDevelopmentMode: 'Error Details (Development Mode)',
    goHome: 'Go Home',
    retry: 'Retry',
  },
};
