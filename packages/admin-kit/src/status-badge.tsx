const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200' },
  rendered: { label: 'Rendered', className: 'bg-green-50 text-green-700 border-green-200' },
  synced: { label: 'Synced', className: 'bg-green-50 text-green-700 border-green-200' },
  enabled: { label: 'Enabled', className: 'bg-green-50 text-green-700 border-green-200' },
  qualified: { label: 'Qualified', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  running: { label: 'Running', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready: { label: 'Ready', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  draft: { label: 'Draft', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  paused: { label: 'Paused', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  queued: { label: 'Queued', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  contacted: { label: 'Contacted', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700 border-red-200' },
  unqualified: { label: 'Unqualified', className: 'bg-red-50 text-red-700 border-red-200' },
  archived: { label: 'Archived', className: 'bg-gray-50 text-gray-400 border-gray-200' },
};

export interface PluginStatusBadgeProps {
  status: string;
  label?: string;
}

export function PluginStatusBadge({ status, label }: PluginStatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {label ?? config.label}
    </span>
  );
}
