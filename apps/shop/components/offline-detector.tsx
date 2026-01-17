'use client';

import * as React from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineDetectorProps {
  /** Custom offline message */
  offlineMessage?: string;
  /** Custom online message */
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
  offlineMessage = 'You are currently offline. Some features may be unavailable.',
  onlineMessage = 'Network restored',
  position = 'top',
  className,
  onOnline,
  onOffline,
}: OfflineDetectorProps) {
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
        <span className="text-sm font-medium">{offlineMessage}</span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 p-1 hover:bg-amber-600 rounded transition-colors"
          aria-label="Dismiss notice"
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
        <span className="text-sm font-medium">{onlineMessage}</span>
      </div>
    );
  }

  return null;
}

export default OfflineDetector;

