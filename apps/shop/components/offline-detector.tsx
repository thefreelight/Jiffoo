'use client';

import * as React from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineDetectorProps {
  /** 自定义离线消息 */
  offlineMessage?: string;
  /** 自定义恢复消息 */
  onlineMessage?: string;
  /** 显示位置 */
  position?: 'top' | 'bottom';
  /** 自定义类名 */
  className?: string;
  /** 网络恢复时的回调 */
  onOnline?: () => void;
  /** 网络断开时的回调 */
  onOffline?: () => void;
}

/**
 * 离线检测组件
 * 
 * 监听网络状态，在离线时显示提示条
 * 网络恢复时自动隐藏并可触发回调
 */
export function OfflineDetector({
  offlineMessage = '您当前处于离线状态，部分功能可能不可用',
  onlineMessage = '网络已恢复',
  position = 'top',
  className,
  onOnline,
  onOffline,
}: OfflineDetectorProps) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [showOnlineNotice, setShowOnlineNotice] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    // 初始化状态
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineNotice(true);
      setDismissed(false);
      onOnline?.();
      
      // 3秒后隐藏恢复提示
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

  // 不显示任何内容的情况
  if ((isOnline && !showOnlineNotice) || dismissed) {
    return null;
  }

  const positionClass = position === 'top' 
    ? 'top-0' 
    : 'bottom-0';

  // 离线状态
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
          aria-label="关闭提示"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // 恢复在线状态提示
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

