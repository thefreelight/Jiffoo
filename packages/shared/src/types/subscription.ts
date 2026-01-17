/**
 * Subscription Types
 * Types for subscription management system
 */

/**
 * Subscription Status
 */
export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',           // Active
    TRIALING = 'TRIALING',       // Trialing
    PAST_DUE = 'PAST_DUE',       // Past due (within grace period)
    CANCELLED = 'CANCELLED',     // Cancelled
    EXPIRED = 'EXPIRED',         // Expired
}

/**
 * Billing Cycle
 */
export enum BillingCycle {
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY',
}

/**
 * Plan Change Type
 */
export enum PlanChangeType {
    UPGRADE = 'UPGRADE',
    DOWNGRADE = 'DOWNGRADE',
}

/**
 * Plan Change Status
 */
export enum PlanChangeStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

/**
 * Subscription Interface
 */
export interface Subscription {
    id: string;
    userId: string;
    productId: string;
    licenseId?: string;

    // Plan info
    planId: string;
    planName: string;

    // Billing
    billingCycle: BillingCycle;
    price: number;
    currency: string;

    // Status
    status: SubscriptionStatus;

    // Dates
    startedAt: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt?: Date;
    cancelAtPeriodEnd: boolean;

    // Renewal
    autoRenew: boolean;
    nextBillingDate?: Date;

    // Grace period
    gracePeriodEnd?: Date;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Plan Change Record
 */
export interface PlanChange {
    id: string;
    subscriptionId: string;
    fromPlanId: string;
    toPlanId: string;
    changeType: PlanChangeType;
    effectiveDate: Date;
    proratedAmount?: number;
    newPrice: number;
    status: PlanChangeStatus;
    createdAt: Date;
}

/**
 * Coupon Types
 */
export enum CouponType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED = 'FIXED',
}

export enum CouponStatus {
    ACTIVE = 'ACTIVE',
    EXHAUSTED = 'EXHAUSTED',
    EXPIRED = 'EXPIRED',
    DISABLED = 'DISABLED',
}

export interface Coupon {
    id: string;
    code: string;
    type: CouponType;
    value: number;

    // Limits
    maxUses: number;
    maxUsesPerUser: number;
    usedCount: number;

    // Validity
    validFrom: Date;
    validUntil: Date;

    // Restrictions
    applicableProducts?: string[];
    applicableCategories?: string[];
    minOrderAmount?: number;

    // Status
    status: CouponStatus;
    isActive: boolean;
    createdAt: Date;
}

export interface CouponUsage {
    id: string;
    couponId: string;
    userId: string;
    orderId: string;
    discountAmount: number;
    usedAt: Date;
}

/**
 * Bundle Types
 */
export interface Bundle {
    id: string;
    name: string;
    description: string;

    // Items
    items: BundleItem[];

    // Pricing
    originalPrice: number;
    bundlePrice: number;
    savingsAmount: number;
    savingsPercentage: number;

    // Status
    isActive: boolean;
    validFrom?: Date;
    validUntil?: Date;

    createdAt: Date;
}

export interface BundleItem {
    productId: string;
    productName: string;
    productType: 'plugin' | 'theme' | 'software';
    originalPrice: number;
}

/**
 * Plugin Marketplace Types
 */
export enum PluginCategory {
    PAYMENT = 'PAYMENT',
    NOTIFICATION = 'NOTIFICATION',
    ANALYTICS = 'ANALYTICS',
    MARKETING = 'MARKETING',
    AUTH = 'AUTH',
    CORE_BUSINESS = 'CORE_BUSINESS',
    ENTERPRISE = 'ENTERPRISE',
    LOCALIZATION = 'LOCALIZATION',
    CONTENT = 'CONTENT',
}

export enum PluginPricingModel {
    FREE = 'FREE',
    ONE_TIME = 'ONE_TIME',
    SUBSCRIPTION = 'SUBSCRIPTION',
    FREEMIUM = 'FREEMIUM',
}

export interface PluginMarketplaceItem {
    id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription: string;

    // Author
    authorId: string;
    authorName: string;

    // Category & Tags
    category: PluginCategory;
    tags: string[];

    // Versioning
    version: string;
    minCoreVersion?: string;

    // Media
    icon?: string;
    screenshots: string[];

    // Pricing
    pricingModel: PluginPricingModel;
    price: number;
    currency: string;

    // Stats
    downloadCount: number;
    rating: number;
    reviewCount: number;

    // Features
    features: string[];
    changelog: PluginChangelogEntry[];

    // Status
    isActive: boolean;
    isVerified: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export interface PluginChangelogEntry {
    version: string;
    date: Date;
    changes: string[];
}

export interface PluginReview {
    id: string;
    pluginId: string;
    userId: string;
    userName: string;
    rating: number; // 1-5
    title: string;
    content: string;
    isVerifiedPurchase: boolean;
    createdAt: Date;
}
