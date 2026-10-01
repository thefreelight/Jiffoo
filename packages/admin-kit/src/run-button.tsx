import { useState } from 'react';

export interface PluginRunButtonProps {
  onClick: () => Promise<void>;
  label?: string;
  runningLabel?: string;
}

export function PluginRunButton({ onClick, label = 'Run now', runningLabel = 'Running...' }: PluginRunButtonProps) {
  const [isRunning, setIsRunning] = useState(false);

  return (
    <button
      type="button"
      disabled={isRunning}
      onClick={() => {
        setIsRunning(true);
        void onClick().finally(() => setIsRunning(false));
      }}
      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRunning ? runningLabel : label}
    </button>
  );
}
