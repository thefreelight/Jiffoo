import type { ReactNode } from 'react';

export interface PluginSettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function PluginSettingsSection({ title, children }: PluginSettingsSectionProps) {
  return (
    <fieldset className="space-y-1 rounded-xl border border-gray-100 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{title}</legend>
      {children}
    </fieldset>
  );
}

export interface PluginFormRowProps {
  label: string;
  children: ReactNode;
}

export function PluginFormRow({ label, children }: PluginFormRowProps) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 lg:grid-cols-3 lg:items-center lg:gap-4">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="lg:col-span-2">{children}</div>
    </div>
  );
}

export interface PluginSettingsFormProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSaving?: boolean;
  saveLabel?: string;
  message?: string;
  isError?: boolean;
  children: ReactNode;
}

export function PluginSettingsForm({
  onSubmit,
  isSaving = false,
  saveLabel = 'Save settings',
  message,
  isError = false,
  children,
}: PluginSettingsFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-1">
      {children}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : saveLabel}
        </button>
        {message ? (
          <span className={`text-sm ${isError ? 'text-red-600' : 'text-gray-600'}`}>{message}</span>
        ) : null}
      </div>
    </form>
  );
}
