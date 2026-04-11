/**
 * Toast Notification Component
 * 
 * Hardcore digital network infrastructure style system messages
 */

import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'bg-[#1c1c1c] border-[#2a2a2a] border-l-green-500 text-[#eaeaea]',
  error: 'bg-[#1c1c1c] border-[#2a2a2a] border-l-red-500 text-[#bdbdbd]',
  info: 'bg-[#1c1c1c] border-[#2a2a2a] border-l-blue-500 text-[#eaeaea]',
  warning: 'bg-[#1c1c1c] border-[#2a2a2a] border-l-amber-500 text-[#bdbdbd]',
};

const iconStyles = {
  success: 'text-[#bdbdbd]',
  error: 'text-[#bdbdbd]',
  info: 'text-[#bdbdbd]',
  warning: 'text-[#bdbdbd]',
};

export function Toast({ id, type, title, message, duration = 4000, onClose }: ToastProps) {
  const Icon = icons[type];

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 border border-l-4 rounded-none  relative overflow-hidden',
        'animate-in slide-in-from-right-full fade-in duration-300',
        'max-w-sm w-full font-mono',
        styles[type]
      )}
      role="alert"
    >
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-white/5 pointer-events-none"></div>

      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconStyles[type])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-3 w-3" />
          <p className="font-bold text-[10px] uppercase tracking-widest">{title || `SYS_MSG_${type.toUpperCase()}`}</p>
        </div>
        <p className="text-xs uppercase leading-relaxed">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 hover:bg-[#181818]/10 transition-colors border border-transparent hover:border-[#2a2a2a]"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Toast Container for positioning
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

