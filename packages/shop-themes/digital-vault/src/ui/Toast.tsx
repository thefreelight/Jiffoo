import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
}

export const Toast = React.memo(function Toast({ title, description, type = 'info' }: ToastProps) {
  const tone =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : type === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
    </div>
  );
});

export const ToastContainer = React.memo(function ToastContainer({
  toasts,
}: {
  toasts?: ToastProps[];
}) {
  if (!toasts?.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
});
