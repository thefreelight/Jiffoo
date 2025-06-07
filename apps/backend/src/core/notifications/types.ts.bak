// 通知类型
export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  WEBHOOK = 'WEBHOOK'
}

// 通知状态
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// 通知优先级
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// 通知类别
export enum NotificationCategory {
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  INVENTORY = 'INVENTORY',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  MARKETING = 'MARKETING',
  SECURITY = 'SECURITY'
}

// 通知模板类型
export enum TemplateType {
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  LOW_STOCK_ALERT = 'LOW_STOCK_ALERT',
  OUT_OF_STOCK_ALERT = 'OUT_OF_STOCK_ALERT',
  USER_WELCOME = 'USER_WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

// 通知接口
export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  templateType?: TemplateType;
  recipient: string; // email, phone, userId等
  subject: string;
  content: string;
  data?: any; // 额外数据
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

// 通知模板接口
export interface NotificationTemplate {
  id: string;
  type: TemplateType;
  name: string;
  description: string;
  subject: string;
  content: string;
  variables: string[]; // 模板变量列表
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 通知偏好设置
export interface NotificationPreference {
  id: string;
  userId: string;
  category: NotificationCategory;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 通知配置
export interface NotificationConfig {
  email: {
    enabled: boolean;
    provider: 'SMTP' | 'SENDGRID' | 'MAILGUN';
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    from: string;
    replyTo?: string;
  };
  sms: {
    enabled: boolean;
    provider: 'TWILIO' | 'NEXMO' | 'AWS_SNS';
    accountSid?: string;
    authToken?: string;
    from: string;
  };
  push: {
    enabled: boolean;
    provider: 'FCM' | 'APNS';
    serverKey?: string;
    bundleId?: string;
  };
  webhook: {
    enabled: boolean;
    endpoints: string[];
    secret?: string;
  };
}

// 发送通知请求
export interface SendNotificationRequest {
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  templateType?: TemplateType;
  recipient: string;
  subject?: string;
  content?: string;
  data?: any;
  scheduledAt?: Date;
  maxRetries?: number;
}

// 批量通知请求
export interface BulkNotificationRequest {
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  templateType?: TemplateType;
  recipients: string[];
  subject?: string;
  content?: string;
  data?: any;
  scheduledAt?: Date;
}

// 通知统计
export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  byType: Record<NotificationType, number>;
  byCategory: Record<NotificationCategory, number>;
  byStatus: Record<NotificationStatus, number>;
  deliveryRate: number;
  failureRate: number;
}

// 库存警告通知数据
export interface InventoryAlertData {
  productId: string;
  productName: string;
  alertType: string;
  currentStock: number;
  threshold: number;
  message: string;
}

// 订单通知数据
export interface OrderNotificationData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress?: string;
  trackingNumber?: string;
}

// 用户通知数据
export interface UserNotificationData {
  userId: string;
  username: string;
  email: string;
  verificationToken?: string;
  resetToken?: string;
  loginLocation?: string;
  loginTime?: Date;
}

// 系统通知数据
export interface SystemNotificationData {
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  affectedServices?: string[];
  estimatedDuration?: string;
  maintenanceWindow?: {
    start: Date;
    end: Date;
  };
}

// 通知队列任务
export interface NotificationJob {
  id: string;
  notification: Notification;
  attempts: number;
  delay?: number;
  priority: number;
  createdAt: Date;
}

// 通知提供商接口
export interface NotificationProvider {
  type: NotificationType;
  name: string;
  send(notification: Notification): Promise<boolean>;
  validateConfig(config: any): boolean;
  getDeliveryStatus?(messageId: string): Promise<NotificationStatus>;
}

// 邮件提供商配置
export interface EmailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
}

// SMS提供商配置
export interface SMSProviderConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

// 推送通知配置
export interface PushProviderConfig {
  serverKey: string;
  bundleId?: string;
}

// 通知事件
export interface NotificationEvent {
  type: 'SENT' | 'DELIVERED' | 'FAILED' | 'OPENED' | 'CLICKED';
  notificationId: string;
  timestamp: Date;
  metadata?: any;
}

// 通知分析数据
export interface NotificationAnalytics {
  period: string;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  topPerformingTemplates: Array<{
    templateType: TemplateType;
    sent: number;
    deliveryRate: number;
    openRate: number;
  }>;
  performanceByChannel: Record<NotificationType, {
    sent: number;
    deliveryRate: number;
    avgDeliveryTime: number;
  }>;
}

// 通知订阅
export interface NotificationSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
