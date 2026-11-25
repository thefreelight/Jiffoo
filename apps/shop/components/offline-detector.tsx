'use client';

import * as React from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from 'shared/src/i18n/react';

interface OfflineDetectorProps {
  /** Custom offline message; the storefront's own copy when unset */
  offlineMessage?: string;
  /** Custom online message; the storefront's own copy when unset */
  onlineMessage?: string;
  /** Display position */
  position?: 'top' | 'bottom';
  /** Custom class name */
  className?: string;
  /** Callback when network is restored */
  onOnline?: () => void;
  /** Callback when network is disconnected */
  onOffline?: () => void;
}

/**
 * Offline Detector Component
 * 
 * Monitors network status and displays a notice when offline.
 * Automatically hides and triggers callback when network is restored.
 */
export function OfflineDetector({
  offlineMessage,
  onlineMessage,
  position = 'top',
  className,
  onOnline,
  onOffline,
}: OfflineDetectorProps) {
  const t = useT();
  // A caller's message wins; otherwise the storefront's language, then English.
  const copy = (key: string, fallback: string, custom?: string) => {
    if (custom) return custom;
    const translated = t?.(key);
    return translated && translated !== key ? translated : fallback;
  };
  const [isOnline, setIsOnline] = React.useState(true);
  const [showOnlineNotice, setShowOnlineNotice] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    // Initialize status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineNotice(true);
      setDismissed(false);
      onOnline?.();

      // Hide online notice after 3 seconds
      setTimeout(() => {
        setShowOnlineNotice(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnline, onOffline]);

  // Cases where nothing is displayed
  if ((isOnline && !showOnlineNotice) || dismissed) {
    return null;
  }

  const positionClass = position === 'top'
    ? 'top-0'
    : 'bottom-0';

  // Offline state
  if (!isOnline) {
    return (
      <div
        className={cn(
          'fixed left-0 right-0 z-50 px-4 py-2',
          'bg-amber-500 text-white',
          'flex items-center justify-center gap-2',
          'animate-in slide-in-from-top duration-300',
          positionClass,
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{copy('common.shell.offline', 'You are currently offline. Some features may be unavailable.', offlineMessage)}</span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 p-1 hover:bg-amber-600 rounded transition-colors"
          aria-label={copy('common.shell.dismissNotice', 'Dismiss notice')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Restore online state notice
  if (showOnlineNotice) {
    return (
      <div
        className={cn(
          'fixed left-0 right-0 z-50 px-4 py-2',
          'bg-green-500 text-white',
          'flex items-center justify-center gap-2',
          'animate-in slide-in-from-top duration-300',
          positionClass,
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <Wifi className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{copy('common.shell.backOnline', 'Network restored', onlineMessage)}</span>
      </div>
    );
  }

  return null;
}

export default OfflineDetector;

