/**
 * eSIM Product Schema - Platform Standard
 *
 * This is the platform-level standard Schema convention for eSIM products.
 * Applies to products with productType="esim".
 */

// ============================================
// Product Level (stored in product.typeData)
// ============================================

/**
 * eSIM product typeData structure
 * Shared information across all variants
 */
export interface ESimProductTypeData {
  /** Product image URLs */
  images: string[];

  /** Brand information */
  brand?: {
    displayName: string;
    supportEmail?: string;
  };

  /** eSIM basic information */
  esim: {
    /** Coverage type */
    coverageType: 'country' | 'region' | 'global';

    /** Coverage details */
    coverage: {
      name: string;
      iso2?: string;
      regions?: string[];
    };

    /** Delivery method */
    delivery: {
      method: 'email' | 'account';
      etaSeconds: number;
    };

    /** Activation policy */
    activationPolicy: {
      startsWhen: 'on_install' | 'on_first_network_use' | 'on_purchase';
      requiresVerification: boolean;
    };

    /** Compatible devices URL */
    compatibleDevicesUrl?: string;

    /** FAQ URL */
    faqUrl?: string;
  };
}

// ============================================
// Variant Level (stored in variant.attributes)
// ============================================

/**
 * eSIM plan attributes structure
 * Differentiated information per variant
 */
export interface ESimVariantAttributes {
  esim: {
    /** Data plan */
    data: {
      /** Data type: limited | unlimited */
      type: 'limited' | 'unlimited';
      /** Data amount in GB (required when type=limited) */
      gb?: number;
      /** Throttle policy */
      throttlePolicy: 'none' | 'throttled_after_limit';
      /** Throttled speed in Kbps */
      throttleKbps?: number;
    };

    /** Validity period in days (required) */
    validityDays: number;

    /** Network information */
    networks: {
      /** Network technology (required) */
      technology: Array<'3G' | '4G' | '5G'>;
      /** Carrier name (recommended) */
      carrier?: string;
      /** Is roaming */
      roaming: boolean;
    };

    /** Features */
    features: {
      /** Supports tethering/hotspot (recommended) */
      tethering: boolean;
      /** Supports voice calls */
      voice: boolean;
      /** Supports SMS */
      sms: boolean;
    };

    /** Policy constraints */
    policy: {
      /** Requires eSIM device */
      requiresEsimDevice: boolean;
      /** One-time install only */
      oneTimeInstall: boolean;
      /** Refund policy */
      refund: 'before_activation' | 'no_refund_after_delivery' | 'full_refund_7days' | 'no_refund';
    };

    /** Tag list (required, can be empty array) */
    tags: Array<'best_seller' | 'new' | 'promo' | 'popular' | 'recommended'>;

    /** Marketing information (optional) */
    marketing?: {
      /** Badge text */
      badge?: string;
      /** Badge color */
      badgeColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
    };
  };
}

// ============================================
// Fulfillment Data (stored in orderItem.fulfillmentData)
// ============================================

/**
 * eSIM order item fulfillmentData structure
 * Written by eSIM plugin after order payment succeeds
 */
export interface ESimFulfillmentData {
  /** QR Code image URL (for scanning installation) */
  qrCode?: string;

  /** LPA string (for manual entry) */
  lpa?: string;

  /** SM-DP+ address */
  smdp?: string;

  /** Activation code */
  activationCode?: string;

  /** Installation instructions */
  instructions?: {
    /** iOS installation steps */
    ios?: string[];
    /** Android installation steps */
    android?: string[];
    /** General steps */
    general?: string[];
  };

  /** Support information */
  support?: {
    email?: string;
    phone?: string;
    chatUrl?: string;
  };

  /** ICCID (eSIM unique identifier) */
  iccid?: string;

  /** Expiration time (ISO 8601 format) */
  expiresAt?: string;

  /** Activation status */
  activationStatus?: 'pending' | 'active' | 'expired' | 'cancelled';

  /** Usage information (if available) */
  usage?: {
    dataUsedMB?: number;
    dataTotalMB?: number;
    lastUpdatedAt?: string;
  };
}

// ============================================
// Helper Types
// ============================================

/**
 * Complete eSIM Product type (with parsed typeData)
 */
export interface ESimProduct {
  id: string;
  name: string;
  description?: string;
  productType: 'esim';
  /** Parsed typeData */
  typeData: ESimProductTypeData;
  variants: ESimVariant[];
}

/**
 * Complete eSIM Variant type (with parsed attributes)
 */
export interface ESimVariant {
  id: string;
  name: string;
  basePrice: number;
  baseStock: number;
  isDefault: boolean;
  isActive: boolean;
  /** Parsed attributes */
  attributes: ESimVariantAttributes;
}

// ============================================
// Type Guards and Utility Functions
// ============================================

/**
 * Check if product is an eSIM product
 */
export function isESimProduct(product: { productType?: string }): boolean {
  return product.productType === 'esim';
}

/**
 * Parse Product.typeData to ESimProductTypeData
 */
export function parseESimProductTypeData(typeData: string | null | undefined): ESimProductTypeData | null {
  if (!typeData) return null;

  try {
    const parsed = typeof typeData === 'string' ? JSON.parse(typeData) : typeData;

    // Basic validation
    if (!parsed.esim || !parsed.esim.coverageType) {
      return null;
    }

    return parsed as ESimProductTypeData;
  } catch {
    return null;
  }
}

/**
 * Parse Variant.attributes to ESimVariantAttributes
 */
export function parseESimVariantAttributes(attributes: string | null | undefined): ESimVariantAttributes | null {
  if (!attributes) return null;

  try {
    const parsed = typeof attributes === 'string' ? JSON.parse(attributes) : attributes;

    // Basic validation
    if (!parsed.esim || typeof parsed.esim.validityDays !== 'number') {
      return null;
    }

    return parsed as ESimVariantAttributes;
  } catch {
    return null;
  }
}

/**
 * Parse OrderItem.fulfillmentData to ESimFulfillmentData
 */
export function parseESimFulfillmentData(
  fulfillmentData: Record<string, unknown> | string | null | undefined
): ESimFulfillmentData | null {
  if (!fulfillmentData) return null;

  try {
    const parsed = typeof fulfillmentData === 'string'
      ? JSON.parse(fulfillmentData)
      : fulfillmentData;

    return parsed as ESimFulfillmentData;
  } catch {
    return null;
  }
}

/**
 * Get data display text
 */
export function getDataDisplayText(data: ESimVariantAttributes['esim']['data'], locale: 'en' | 'zh-Hant' = 'en'): string {
  if (data.type === 'unlimited') {
    return 'Unlimited Data';
  }

  if (data.gb) {
    return `${data.gb}GB`;
  }

  return 'Data';
}

/**
 * Get validity display text
 */
export function getValidityDisplayText(validityDays: number, locale: 'en' | 'zh-Hant' = 'en'): string {
  return `${validityDays} ${validityDays === 1 ? 'Day' : 'Days'}`;
}

/**
 * Get network technology display text
 */
export function getNetworkDisplayText(networks: ESimVariantAttributes['esim']['networks']): string {
  return networks.technology.join('/');
}

/**
 * Get badge color class
 */
export function getBadgeColorClass(color?: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };

  return colorMap[color || 'blue'] || colorMap.blue;
}
