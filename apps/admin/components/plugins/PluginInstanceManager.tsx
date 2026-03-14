'use client'

/**
 * Plugin Instance Manager
 *
 * Manage multiple runtime instances for a single plugin.
 */

import { useState } from 'react'
import { Plus, Trash2, Power, PowerOff, Copy, MoreVertical } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  usePluginInstances,
  useCreatePluginInstance,
  useUpdatePluginInstance,
  useDeletePluginInstance,
} from '@/lib/hooks/use-api'
import type { PluginInstance } from '@/lib/api'

interface PluginInstanceManagerProps {
  pluginSlug: string
  pluginName: string
}

export function PluginInstanceManager({ pluginSlug, pluginName }: PluginInstanceManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newInstanceKey, setNewInstanceKey] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data: instancesData, isLoading } = usePluginInstances(pluginSlug)
  const { mutateAsync: createInstance, isPending: isCreating } = useCreatePluginInstance()
  const { mutateAsync: updateInstance, isPending: isUpdating } = useUpdatePluginInstance()
  const { mutateAsync: deleteInstance, isPending: isDeleting } = useDeletePluginInstance()

  const instances = instancesData?.items || []

  const handleCreateInstance = async () => {
    if (!newInstanceKey.trim()) return

    try {
      await createInstance({
        slug: pluginSlug,
        instanceKey: newInstanceKey.trim(),
        enabled: true,
      })
      setNewInstanceKey('')
      setIsCreateDialogOpen(false)
    } catch (_error) {
      // Error toast is handled by the mutation hook.
    }
  }

  const handleToggleEnabled = async (instance: PluginInstance) => {
    try {
      await updateInstance({
        slug: pluginSlug,
        installationId: instance.installationId,
        enabled: !instance.enabled,
      })
    } catch (_error) {
      // Error toast is handled by the mutation hook.
    }
  }

  const handleDeleteInstance = async (installationId: string) => {
    try {
      await deleteInstance({
        slug: pluginSlug,
        installationId,
      })
      setDeleteConfirmId(null)
    } catch (_error) {
      // Error toast is handled by the mutation hook.
    }
  }

  const copyInstanceId = (id: string) => {
    navigator.clipboard.writeText(id)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Instance Management</CardTitle>
          <CardDescription>Loading instances...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Instance Management
              <Badge variant="secondary">{instances.length} instances</Badge>
            </CardTitle>
            <CardDescription>
              Manage runtime instances for {pluginName}. Each instance can have independent config and status.
            </CardDescription>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Instance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Instance</DialogTitle>
                <DialogDescription>
                  Create a new runtime instance for {pluginName}. Each instance must use a unique key.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="instanceKey">Instance Key</Label>
                  <Input
                    id="instanceKey"
                    placeholder="e.g. production, staging, store-1"
                    value={newInstanceKey}
                    onChange={(e) => setNewInstanceKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateInstance()
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a stable and meaningful key to identify this instance.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateInstance} disabled={!newInstanceKey.trim() || isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {instances.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
            <p>No instances yet</p>
            <p className="text-sm mt-1">Click &quot;Create Instance&quot; to add one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => (
              <div
                key={instance.installationId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${instance.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{instance.instanceKey}</span>
                      {instance.instanceKey === 'default' && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-mono">{instance.installationId.slice(0, 8)}...</span>
                      <button
                        onClick={() => copyInstanceId(instance.installationId)}
                        className="hover:text-foreground transition-colors"
                        title="Copy full installation ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${instance.installationId}`} className="text-sm">
                      {instance.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`enabled-${instance.installationId}`}
                      checked={instance.enabled}
                      onCheckedChange={() => handleToggleEnabled(instance)}
                      disabled={isUpdating}
                    />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleToggleEnabled(instance)} disabled={isUpdating}>
                        {instance.enabled ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-2" />
                            Disable Instance
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-2" />
                            Enable Instance
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirmId(instance.installationId)}
                        className="text-destructive focus:text-destructive"
                        disabled={instance.instanceKey === 'default'}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Instance
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                This instance will be disabled and marked as deleted. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && handleDeleteInstance(deleteConfirmId)}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
