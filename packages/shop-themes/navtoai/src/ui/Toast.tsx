import * as React from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type?: ToastType;
  visible?: boolean;
  onClose?: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function Toast({ message, type = 'info', visible = true, onClose }: ToastProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[1rem] border px-4 py-3 text-sm font-medium shadow-[0_18px_38px_-24px_rgba(44,51,90,0.2)]',
        typeStyles[type],
      )}
    >
      <span className="flex-1">{message}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="text-current opacity-60 transition-opacity hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function ToastContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-2', className)}>{children}</div>;
}

