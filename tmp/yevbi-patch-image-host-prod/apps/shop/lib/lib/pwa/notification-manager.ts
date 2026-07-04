/**
 * Notification Manager Utility
 * Handles push notification permissions, subscriptions, and management for PWA
 */

// Types
export interface NotificationPermissionState {
  permission: NotificationPermission;
  canRequest: boolean;
  isDenied: boolean;
  isGranted: boolean;
}

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: unknown;
  requireInteraction?: boolean;
  silent?: boolean;
}

// Constants
const SUBSCRIPTION_KEY = 'pwa_push_subscription';
const PERMISSION_REQUESTED_KEY = 'pwa_notification_permission_requested';

/**
 * Check if notifications are supported in the browser
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'PushManager' in window && 'serviceWorker' in navigator;
}

/**
 * Get current notification permission state
 */
export function getPermissionState(): NotificationPermissionState {
  const permission = isNotificationSupported()
    ? Notification.permission
    : 'default' as NotificationPermission;

  return {
    permission,
    canRequest: permission === 'default',
    isDenied: permission === 'denied',
    isGranted: permission === 'granted',
  };
}

/**
 * Notification Manager Class
 * Manages notification permissions, push subscriptions, and notification delivery
 */
export class NotificationManager {
  private permissionListeners: Set<(state: NotificationPermissionState) => void> = new Set();
  private subscriptionListeners: Set<(subscription: PushSubscription | null) => void> = new Set();
  private currentSubscription: PushSubscription | null = null;

  constructor() {
    this.loadSubscription();
  }

  /**
   * Request notification permission from user
   */
  public async requestPermission(): Promise<NotificationPermissionState> {
    if (!isNotificationSupported()) {
      throw new Error('Notifications are not supported in this browser');
    }

    const currentState = getPermissionState();

    // If already granted or denied, return current state
    if (!currentState.canRequest) {
      return currentState;
    }

    try {
      const permission = await Notification.requestPermission();

      // Mark that permission has been requested
      this.markPermissionRequested();

      const newState = {
        permission,
        canRequest: permission === 'default',
        isDenied: permission === 'denied',
        isGranted: permission === 'granted',
      };

      // Notify listeners
      this.notifyPermissionListeners(newState);

      return newState;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  public async subscribeToPush(
    serviceWorkerRegistration: ServiceWorkerRegistration,
    vapidPublicKey: string
  ): Promise<PushSubscription> {
    if (!isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const permissionState = getPermissionState();
    if (!permissionState.isGranted) {
      throw new Error('Notification permission not granted');
    }

    if (!serviceWorkerRegistration.active) {
      throw new Error('Service worker is not active');
    }

    try {
      // Convert VAPID key to Uint8Array
      const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push manager
      const subscription = await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Store subscription
      this.currentSubscription = subscription;
      this.saveSubscription(subscription);

      // Notify listeners
      this.notifySubscriptionListeners(subscription);

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribeFromPush(): Promise<boolean> {
    if (!this.currentSubscription) {
      return false;
    }

    try {
      const success = await this.currentSubscription.unsubscribe();

      if (success) {
        this.currentSubscription = null;
        this.clearSubscription();
        this.notifySubscriptionListeners(null);
      }

      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  /**
   * Get current push subscription
   */
  public async getCurrentSubscription(
    serviceWorkerRegistration?: ServiceWorkerRegistration
  ): Promise<PushSubscription | null> {
    if (!isPushSupported()) {
      return null;
    }

    try {
      if (serviceWorkerRegistration) {
        const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
        this.currentSubscription = subscription;
        return subscription;
      }

      return this.currentSubscription;
    } catch (error) {
      console.error('Failed to get current subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription info as a plain object
   */
  public getSubscriptionInfo(subscription: PushSubscription): PushSubscriptionInfo {
    const keys = subscription.toJSON().keys;

    if (!keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid subscription keys');
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      expirationTime: subscription.expirationTime,
    };
  }

  /**
   * Show a local notification
   */
  public async showNotification(
    serviceWorkerRegistration: ServiceWorkerRegistration,
    options: NotificationOptions
  ): Promise<void> {
    const permissionState = getPermissionState();
    if (!permissionState.isGranted) {
      throw new Error('Notification permission not granted');
    }

    try {
      const { title, ...notificationOptions } = options;
      await serviceWorkerRegistration.showNotification(title, notificationOptions);
    } catch (error) {
      console.error('Failed to show notification:', error);
      throw error;
    }
  }

  /**
   * Subscribe to permission state changes
   */
  public onPermissionChange(
    callback: (state: NotificationPermissionState) => void
  ): () => void {
    this.permissionListeners.add(callback);
    // Call immediately with current state
    callback(getPermissionState());
    // Return unsubscribe function
    return () => {
      this.permissionListeners.delete(callback);
    };
  }

  /**
   * Subscribe to subscription changes
   */
  public onSubscriptionChange(
    callback: (subscription: PushSubscription | null) => void
  ): () => void {
    this.subscriptionListeners.add(callback);
    // Call immediately with current subscription
    callback(this.currentSubscription);
    // Return unsubscribe function
    return () => {
      this.subscriptionListeners.delete(callback);
    };
  }

  /**
   * Get current permission state
   */
  public getPermissionState(): NotificationPermissionState {
    return getPermissionState();
  }

  /**
   * Check if permission has been requested before
   */
  public hasPermissionBeenRequested(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      return localStorage.getItem(PERMISSION_REQUESTED_KEY) === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark that permission has been requested
   */
  private markPermissionRequested(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
    } catch (error) {
      console.error('Failed to mark permission as requested:', error);
    }
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Notify permission listeners
   */
  private notifyPermissionListeners(state: NotificationPermissionState): void {
    this.permissionListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in permission listener:', error);
      }
    });
  }

  /**
   * Notify subscription listeners
   */
  private notifySubscriptionListeners(subscription: PushSubscription | null): void {
    this.subscriptionListeners.forEach(listener => {
      try {
        listener(subscription);
      } catch (error) {
        console.error('Error in subscription listener:', error);
      }
    });
  }

  /**
   * Load subscription from localStorage
   */
  private loadSubscription(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(SUBSCRIPTION_KEY);
      if (stored) {
        // Note: We can't fully reconstruct a PushSubscription from JSON
        // This is just for reference. Actual subscription should be retrieved
        // from service worker registration
        const data = JSON.parse(stored);
        // Store the data but subscription should be re-fetched from SW
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  }

  /**
   * Save subscription to localStorage
   */
  private saveSubscription(subscription: PushSubscription): void {
    if (typeof window === 'undefined') return;

    try {
      const subscriptionData = this.getSubscriptionInfo(subscription);
      localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscriptionData));
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  }

  /**
   * Clear subscription from localStorage
   */
  private clearSubscription(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(SUBSCRIPTION_KEY);
    } catch (error) {
      console.error('Failed to clear subscription:', error);
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.permissionListeners.clear();
    this.subscriptionListeners.clear();
    this.currentSubscription = null;
  }
}

// Export singleton instance
let instance: NotificationManager | null = null;

/**
 * Get singleton instance of NotificationManager
 */
export function getNotificationManager(): NotificationManager {
  if (!instance) {
    instance = new NotificationManager();
  }
  return instance;
}

// Default export
export default NotificationManager;
