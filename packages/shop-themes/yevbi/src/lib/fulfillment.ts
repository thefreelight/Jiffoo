/**
 * Fulfillment Data Utilities
 * Handles product type classification and fulfillment data building
 */

export type ProductClass = 'esim' | 'data' | 'card' | 'unknown';

export interface TypeData {
  sourceProductType?: string;
  productType?: string;
  requiredUid?: boolean;
  requiresShipping?: boolean;
  [key: string]: unknown;
}

export interface FulfillmentFormState {
  // DATA & ESIM
  cardUid: string;
  lpaString: string;
  apn: string;
  
  // CARD
  shippingAddress: {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    email: string;
  };
}

export interface FulfillmentValidation {
  isValid: boolean;
  errors: Record<string, string>;
  firstInvalidField: string | null;
}

/**
 * Parse typeData from product
 */
export function parseTypeData(typeData: unknown): TypeData | null {
  if (!typeData) return null;
  
  if (typeof typeData === 'string') {
    try {
      return JSON.parse(typeData) as TypeData;
    } catch {
      return null;
    }
  }
  
  if (typeof typeData === 'object' && !Array.isArray(typeData)) {
    return typeData as TypeData;
  }
  
  return null;
}

/**
 * Classify product type
 */
export function classifyProductType(typeData: TypeData | null): ProductClass {
  if (!typeData) return 'unknown';
  
  const productType = (typeData.sourceProductType || typeData.productType || '').toLowerCase();
  
  if (productType === 'esim') return 'esim';
  if (productType === 'data' || productType === 'effective_date' || productType === 'external_data') return 'data';
  if (productType === 'card' || productType === 'esim-card' || productType === 'ota-card') return 'card';
  
  return 'unknown';
}

/**
 * Check if product requires cardUid
 */
export function requiresCardUid(typeData: TypeData | null, productClass: ProductClass): boolean {
  if (productClass === 'data') return true;
  if (typeData?.requiredUid === true) return true;
  return false;
}

/**
 * Check if product requires shipping address
 */
export function requiresShippingAddress(typeData: TypeData | null, productClass: ProductClass): boolean {
  if (productClass === 'card') return true;
  if (typeData?.requiresShipping === true) return true;
  return false;
}

/**
 * Validate fulfillment form
 */
export function validateFulfillmentForm(
  formState: FulfillmentFormState,
  typeData: TypeData | null
): FulfillmentValidation {
  const errors: Record<string, string> = {};
  const productClass = classifyProductType(typeData);
  
  // DATA: cardUid is REQUIRED
  if (requiresCardUid(typeData, productClass)) {
    if (!formState.cardUid.trim()) {
      errors.cardUid = 'Card UID is required';
    }
  }
  
  // CARD: shippingAddress is REQUIRED
  if (requiresShippingAddress(typeData, productClass)) {
    const addr = formState.shippingAddress;
    
    if (!addr.firstName.trim() && !addr.lastName.trim()) {
      errors['shippingAddress.firstName'] = 'Name is required';
    }
    if (!addr.addressLine1.trim()) {
      errors['shippingAddress.addressLine1'] = 'Address is required';
    }
    if (!addr.city.trim()) {
      errors['shippingAddress.city'] = 'City is required';
    }
    if (!addr.country.trim()) {
      errors['shippingAddress.country'] = 'Country is required';
    }
  }
  
  const firstInvalidField = Object.keys(errors)[0] || null;
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstInvalidField,
  };
}

/**
 * Build fulfillment data for API submission
 */
export function buildFulfillmentData(
  typeData: TypeData | null,
  formState: FulfillmentFormState
): Record<string, unknown> | undefined {
  const productClass = classifyProductType(typeData);
  
  // DATA: { cardUid }
  if (productClass === 'data') {
    return {
      cardUid: formState.cardUid.trim(),
    };
  }
  
  // ESIM: {} OR { cardUid } if provided
  if (productClass === 'esim') {
    const cardUid = formState.cardUid.trim();
    if (cardUid) {
      return { cardUid };
    }
    return undefined; // No fulfillment data needed
  }
  
  // CARD: { shippingAddress }
  if (productClass === 'card') {
    const addr = formState.shippingAddress;
    return {
      shippingAddress: {
        firstName: addr.firstName.trim(),
        lastName: addr.lastName.trim(),
        phone: addr.phone.trim(),
        addressLine1: addr.addressLine1.trim(),
        addressLine2: addr.addressLine2.trim(),
        city: addr.city.trim(),
        state: addr.state.trim(),
        postalCode: addr.postalCode.trim(),
        country: addr.country.trim(),
        email: addr.email.trim(),
      },
    };
  }
  
  return undefined;
}

/**
 * Get initial form state
 */
export function getInitialFormState(): FulfillmentFormState {
  return {
    cardUid: '',
    lpaString: '',
    apn: '',
    shippingAddress: {
      firstName: '',
      lastName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      email: '',
    },
  };
}
