'use client';

import * as React from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
    addToast({
      title: options.title,
      description: options.description,
      type: options.variant === 'destructive' ? 'error' : 'success',
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success-base" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-danger-base" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-base" />;
      case 'info':
        return <Info className="w-5 h-5 text-action-base" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-success-base';
      case 'error':
        return 'border-danger-base';
      case 'warning':
        return 'border-warning-base';
      case 'info':
        return 'border-action-base';
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-success-veil';
      case 'error':
        return 'bg-danger-veil';
      case 'warning':
        return 'bg-warning-veil';
      case 'info':
        return 'bg-action-veil';
    }
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg backdrop-blur-sm
        ${getBorderColor()} ${getBackgroundColor()}
        animate-in slide-in-from-right-full duration-300
      `}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-neutral-deepest">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="mt-1 text-sm text-neutral-strong">
            {toast.description}
          </p>
        )}
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded-md hover:bg-neutral-soft transition-colors"
      >
        <X className="w-4 h-4 text-neutral-base" />
      </button>
    </div>
  );
}
