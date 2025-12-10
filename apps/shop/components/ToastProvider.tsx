'use client';

/**
 * Toast Provider Component
 *
 * Renders toast notifications from the global toast store
 */

import React from 'react';
import { useToastStore } from '@/store/toast';
import { Toast, ToastContainer } from '@shop-themes/default';

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <ToastContainer>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          onClose={removeToast}
        />
      ))}
    </ToastContainer>
  );
}

