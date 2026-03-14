import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getNotificationManager,
  getPermissionState,
  isNotificationSupported,
  isPushSupported,
  type NotificationPermissionState,
  type PushSubscriptionInfo,
} from '@/lib/pwa/notification-manager';

// API endpoint for notifications
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface PushNotificationState {
  permissionState: NotificationPermissionState;
  subscription: PushSubscriptionInfo | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  vapidPublicKey: string | null;
}

interface PushNotificationActions {
  // Initialize and check current state
  initialize: () => Promise<void>;
  // Request notification permission
  requestPermission: () => Promise<boolean>;
  // Subscribe to push notifications
  subscribe: () => Promise<boolean>;
  // Unsubscribe from push notifications
  unsubscribe: () => Promise<boolean>;
  // Refresh subscription status
  refreshSubscription: () => Promise<void>;
  // Clear error
  clearError: () => void;
  // Reset state
  reset: () => void;
}

const initialState: PushNotificationState = {
  permissionState: {
    permission: 'default',
    canRequest: true,
    isDenied: false,
    isGranted: false,
  },
  subscription: null,
  isSubscribed: false,
  isLoading: false,
  error: null,
  vapidPublicKey: null,
};

export const usePushNotification = create<PushNotificationState & PushNotificationActions>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      initialize: async () => {
        const state = get();

        // Skip if already initialized or not supported
        if (state.vapidPublicKey !== null || !isNotificationSupported()) {
          return;
        }

        try {
          set({ isLoading: true, error: null });

          // Fetch VAPID public key from API
          const response = await fetch(`${API_BASE}/notifications/vapid-public-key`);
          if (!response.ok) {
            throw new Error('Failed to fetch VAPID public key');
          }

          const data = await response.json();
          const vapidPublicKey = data.data?.publicKey || data.publicKey;

          if (!vapidPublicKey) {
            throw new Error('VAPID public key not found in response');
          }

          // Get current permission state
          const permissionState = getPermissionState();

          // Check for existing subscription
          const manager = getNotificationManager();
          let subscription: PushSubscriptionInfo | null = null;
          let isSubscribed = false;

          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
              const registration = await navigator.serviceWorker.ready;
              const pushSubscription = await manager.getCurrentSubscription(registration);

              if (pushSubscription) {
                subscription = manager.getSubscriptionInfo(pushSubscription);
                isSubscribed = true;
              }
            } catch (error) {
              console.warn('Failed to get current subscription:', error);
            }
          }

          set({
            vapidPublicKey,
            permissionState,
            subscription,
            isSubscribed,
            isLoading: false,
          });
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as Error).message || 'Failed to initialize push notifications',
          });
        }
      },

      requestPermission: async () => {
        if (!isNotificationSupported()) {
          set({ error: 'Notifications are not supported in this browser' });
          return false;
        }

        try {
          set({ isLoading: true, error: null });

          const manager = getNotificationManager();
          const permissionState = await manager.requestPermission();

          set({
            permissionState,
            isLoading: false,
          });

          return permissionState.isGranted;
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as Error).message || 'Failed to request notification permission',
          });
          return false;
        }
      },

      subscribe: async () => {
        const { vapidPublicKey, permissionState } = get();

        if (!isPushSupported()) {
          set({ error: 'Push notifications are not supported in this browser' });
          return false;
        }

        if (!permissionState.isGranted) {
          set({ error: 'Notification permission not granted' });
          return false;
        }

        if (!vapidPublicKey) {
          set({ error: 'VAPID public key not available' });
          return false;
        }

        try {
          set({ isLoading: true, error: null });

          // Get service worker registration
          const registration = await navigator.serviceWorker.ready;

          // Subscribe to push
          const manager = getNotificationManager();
          const pushSubscription = await manager.subscribeToPush(registration, vapidPublicKey);
          const subscriptionInfo = manager.getSubscriptionInfo(pushSubscription);

          // Send subscription to backend
          const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          const response = await fetch(`${API_BASE}/notifications/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify(subscriptionInfo),
          });

          if (!response.ok) {
            throw new Error('Failed to save subscription to server');
          }

          set({
            subscription: subscriptionInfo,
            isSubscribed: true,
            isLoading: false,
          });

          return true;
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as Error).message || 'Failed to subscribe to push notifications',
          });
          return false;
        }
      },

      unsubscribe: async () => {
        const { subscription } = get();

        if (!subscription) {
          return true; // Already unsubscribed
        }

        try {
          set({ isLoading: true, error: null });

          // Unsubscribe from push
          const manager = getNotificationManager();
          await manager.unsubscribeFromPush();

          // Notify backend
          const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          try {
            await fetch(`${API_BASE}/notifications/unsubscribe`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
          } catch (error) {
            console.warn('Failed to notify server of unsubscribe:', error);
          }

          set({
            subscription: null,
            isSubscribed: false,
            isLoading: false,
          });

          return true;
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as Error).message || 'Failed to unsubscribe from push notifications',
          });
          return false;
        }
      },

      refreshSubscription: async () => {
        try {
          set({ isLoading: true, error: null });

          const permissionState = getPermissionState();
          const manager = getNotificationManager();

          let subscription: PushSubscriptionInfo | null = null;
          let isSubscribed = false;

          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            const pushSubscription = await manager.getCurrentSubscription(registration);

            if (pushSubscription) {
              subscription = manager.getSubscriptionInfo(pushSubscription);
              isSubscribed = true;
            }
          }

          set({
            permissionState,
            subscription,
            isSubscribed,
            isLoading: false,
          });
        } catch (error: unknown) {
          set({
            isLoading: false,
            error: (error as Error).message || 'Failed to refresh subscription',
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'push-notification-storage',
      // Only persist subscription info and vapid key
      partialize: (state) => ({
        subscription: state.subscription,
        vapidPublicKey: state.vapidPublicKey,
        isSubscribed: state.isSubscribed,
      }),
    }
  )
);

// Export types for convenience
export type { NotificationPermissionState, PushSubscriptionInfo };
