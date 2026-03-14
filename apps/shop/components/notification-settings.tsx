'use client';

import * as React from 'react';
import { usePushNotification } from '@/hooks/use-push-notification';
import { isNotificationSupported, isPushSupported } from '@/lib/pwa/notification-manager';

export function NotificationSettings() {
  const {
    permissionState,
    isSubscribed,
    isLoading,
    error,
    initialize,
    requestPermission,
    subscribe,
    unsubscribe,
    clearError,
  } = usePushNotification();

  const [mounted, setMounted] = React.useState(false);

  // Initialize on mount
  React.useEffect(() => {
    setMounted(true);
    initialize().catch((err) => {
      console.error('Failed to initialize push notifications:', err);
    });
  }, [initialize]);

  // Handle toggle change
  const handleToggle = React.useCallback(async () => {
    // Clear any previous errors
    clearError();

    if (isSubscribed) {
      // Unsubscribe
      await unsubscribe();
    } else {
      // Request permission if not granted
      if (!permissionState.isGranted) {
        const granted = await requestPermission();
        if (!granted) {
          return;
        }
      }

      // Subscribe to push notifications
      await subscribe();
    }
  }, [isSubscribed, permissionState.isGranted, requestPermission, subscribe, unsubscribe, clearError]);

  // Don't render on server
  if (!mounted) {
    return null;
  }

  // Check browser support
  if (!isNotificationSupported() || !isPushSupported()) {
    return null; // Notifications not supported, hide the component
  }

  // Don't show if permission is denied
  if (permissionState.isDenied) {
    return (
      <div className="notification-settings">
        <div className="notification-settings__denied">
          <p>Push notifications are blocked. Please enable them in your browser settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-settings">
      <div className="notification-settings__toggle">
        <label htmlFor="notification-toggle" className="notification-settings__label">
          <span className="notification-settings__title">Push Notifications</span>
          <span className="notification-settings__description">
            Receive updates about your orders and special offers
          </span>
        </label>

        <div className="notification-settings__control">
          <input
            id="notification-toggle"
            type="checkbox"
            checked={isSubscribed}
            onChange={handleToggle}
            disabled={isLoading}
            className="notification-settings__checkbox"
          />
          <span className="notification-settings__switch" />
        </div>
      </div>

      {error && (
        <div className="notification-settings__error">
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="notification-settings__loading">
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
