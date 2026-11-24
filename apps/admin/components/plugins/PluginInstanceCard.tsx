'use client';

/**
 * Instance list for a plugin. The page header owns the on/off switch of the
 * selected instance, so this card only lists instances and manages the extra
 * ones (create, delete); it never repeats the enable control.
 */

import { useState } from 'react';
import { Boxes, Copy, Loader2, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreatePluginInstance,
  useDeletePluginInstance,
} from '@/lib/hooks/use-api';
import type { PluginInstance } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { WorkspaceCard, workspaceFieldLabelClass, workspaceOutlineButtonClass, workspacePrimaryButtonClass } from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

export function PluginInstanceCard(props: {
  pluginSlug: string;
  pluginName: string;
  instances: PluginInstance[];
  selectedInstallationId: string | null;
  onSelect: (installationId: string) => void;
}) {
  const { pluginSlug, pluginName, instances, selectedInstallationId, onSelect } = props;
  const tf = useWorkspaceText();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newInstanceKey, setNewInstanceKey] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { mutateAsync: createInstance, isPending: isCreating } = useCreatePluginInstance();
  const { mutateAsync: deleteInstance, isPending: isDeleting } = useDeletePluginInstance();

  const handleCreateInstance = async () => {
    const instanceKey = newInstanceKey.trim();
    if (!instanceKey) return;

    try {
      const created = await createInstance({
        slug: pluginSlug,
        instanceKey,
        enabled: true,
      });
      setNewInstanceKey('');
      setIsCreateDialogOpen(false);
      if (created?.installationId) onSelect(created.installationId);
    } catch {
      // Error toast is handled by the mutation hook.
    }
  };

  const handleDeleteInstance = async (installationId: string) => {
    try {
      await deleteInstance({
        slug: pluginSlug,
        installationId,
      });
      setDeleteConfirmId(null);
    } catch {
      // Error toast is handled by the mutation hook.
    }
  };

  const copyInstanceId = (installationId: string) => {
    void navigator.clipboard.writeText(installationId);
    toast.success(tf('copied', 'Copied'));
  };

  const deleteTarget = instances.find((instance) => instance.installationId === deleteConfirmId);

  return (
    <WorkspaceCard
      icon={<Boxes className="h-6 w-6" />}
      title={tf('instancesTitle', 'Instances')}
      badge={
        <Badge variant="secondary" className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
          {instances.length}
        </Badge>
      }
      description={tf(
        'instancesDescription',
        'Run more than one copy of this plugin, each with its own settings and on/off state.',
      )}
      actions={
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className={workspaceOutlineButtonClass}>
              <Plus className="mr-2 h-4 w-4" />
              {tf('createInstance', 'Create instance')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tf('createInstanceTitle', 'Create instance')}</DialogTitle>
              <DialogDescription>
                {tf('createInstanceDescription', 'Create another run of {name}.', { name: pluginName })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-4">
              <Label htmlFor="plugin-instance-key" className={workspaceFieldLabelClass}>
                {tf('instanceKey', 'Instance key')}
              </Label>
              <Input
                id="plugin-instance-key"
                placeholder={tf('instanceKeyPlaceholder', 'e.g. production, staging, store-1')}
                value={newInstanceKey}
                onChange={(event) => setNewInstanceKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreateInstance();
                  }
                }}
              />
              <p className="text-xs leading-5 text-gray-500">
                {tf('instanceKeyHint', 'Use a stable, meaningful key to tell instances apart.')}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" className={workspaceOutlineButtonClass} onClick={() => setIsCreateDialogOpen(false)}>
                {tf('common.actions.cancel', 'Cancel')}
              </Button>
              <Button
                className={workspacePrimaryButtonClass}
                onClick={() => void handleCreateInstance()}
                disabled={!newInstanceKey.trim() || isCreating}
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isCreating ? tf('saving', 'Saving...') : tf('create', 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {instances.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-100 px-4 py-10 text-center text-sm text-gray-500">
          {tf(
            'noInstances',
            'No instance yet. A default instance is created when you save settings or enable the plugin.',
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => {
            const isSelected = instance.installationId === selectedInstallationId;

            return (
              <div
                key={instance.installationId}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors',
                  isSelected ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 hover:bg-gray-50/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(instance.installationId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', instance.enabled ? 'bg-emerald-500' : 'bg-gray-300')} />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{instance.instanceKey}</span>
                    {instance.instanceKey === 'default' ? (
                      <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        {tf('defaultInstance', 'Default')}
                      </Badge>
                    ) : null}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 text-xs font-semibold text-gray-500">
                    {instance.enabled ? tf('common.status.enabled', 'Enabled') : tf('common.status.disabled', 'Disabled')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700"
                    onClick={() => copyInstanceId(instance.installationId)}
                    title={tf('copyInstanceId', 'Copy installation ID')}
                    aria-label={tf('copyInstanceId', 'Copy installation ID')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {instance.instanceKey === 'default' ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteConfirmId(instance.installationId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tf('deleteInstance', 'Delete instance')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(deleteConfirmId)} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tf('deleteInstanceTitle', 'Delete instance')}</DialogTitle>
            <DialogDescription>
              {tf(
                'deleteInstanceDescription',
                'Instance {key} will be disabled and marked as deleted. This cannot be undone.',
                { key: deleteTarget?.instanceKey ?? '' },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className={workspaceOutlineButtonClass} onClick={() => setDeleteConfirmId(null)}>
              {tf('common.actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              className={workspacePrimaryButtonClass}
              onClick={() => deleteConfirmId && void handleDeleteInstance(deleteConfirmId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isDeleting ? tf('common.actions.processing', 'Processing...') : tf('common.actions.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceCard>
  );
}
