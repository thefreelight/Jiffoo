import type { ReactNode } from 'react';

export interface PluginEmptyStateProps {
  message: string;
  action?: ReactNode;
}

export function PluginEmptyState({ message, action }: PluginEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
      <p className="max-w-md text-sm text-gray-500">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
