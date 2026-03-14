/**
 * A/B Testing Configuration Component
 *
 * Allows merchants to configure and manage A/B tests for recommendation algorithms.
 * Supports creating, updating, enabling/disabling, and deleting test configurations.
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'
import { Settings, Plus, Edit, Trash2, AlertCircle } from 'lucide-react'

interface ABTestConfig {
  id: string
  name: string
  recommendationType: 'customers-also-bought' | 'frequently-bought-together' | 'personalized'
  algorithm: string
  isActive: boolean
  trafficPercentage: number
  priority: number
  parameters?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export function ABTestingConfig() {
  const t = useT()
  const [configs, setConfigs] = useState<ABTestConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ABTestConfig | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    recommendationType: 'customers-also-bought' as string,
    algorithm: '',
    isActive: true,
    trafficPercentage: 100,
    priority: 0,
    parameters: {}
  })

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Load configurations
  useEffect(() => {
    loadConfigs()
  }, [filterType])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call when admin API hooks are implemented
      // const queryString = filterType !== 'all' ? `?recommendationType=${filterType}` : ''
      // const response = await fetch(`/api/recommendations/ab-config${queryString}`)
      // const data = await response.json()
      // setConfigs(data.data || [])

      // Mock data for demonstration
      const mockConfigs: ABTestConfig[] = [
        {
          id: '1',
          name: 'Collaborative Filtering v1',
          recommendationType: 'customers-also-bought',
          algorithm: 'collaborative-filtering',
          isActive: true,
          trafficPercentage: 80,
          priority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Enhanced Bundle Detection',
          recommendationType: 'frequently-bought-together',
          algorithm: 'bundle-detection-v2',
          isActive: true,
          trafficPercentage: 50,
          priority: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'ML-based Personalization',
          recommendationType: 'personalized',
          algorithm: 'ml-personalization',
          isActive: false,
          trafficPercentage: 20,
          priority: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      setConfigs(filterType === 'all' ? mockConfigs : mockConfigs.filter(c => c.recommendationType === filterType))
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('merchant.recommendations.config.loadFailed', 'Failed to load configurations: ') + errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConfig = async () => {
    setSaving(true)
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/recommendations/ab-config', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // })
      // const data = await response.json()

      toast.success(getText('merchant.recommendations.config.createSuccess', 'Configuration created successfully'))
      setShowCreateDialog(false)
      resetForm()
      loadConfigs()
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('merchant.recommendations.config.createFailed', 'Failed to create configuration: ') + errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateConfig = async (config: ABTestConfig) => {
    setSaving(true)
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/recommendations/ab-config/${config.id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // })
      // const data = await response.json()

      toast.success(getText('merchant.recommendations.config.updateSuccess', 'Configuration updated successfully'))
      setEditingConfig(null)
      resetForm()
      loadConfigs()
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('merchant.recommendations.config.updateFailed', 'Failed to update configuration: ') + errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (config: ABTestConfig) => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/recommendations/ab-config/${config.id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ isActive: !config.isActive })
      // })

      toast.success(
        config.isActive
          ? getText('merchant.recommendations.config.disabled', 'Configuration disabled')
          : getText('merchant.recommendations.config.enabled', 'Configuration enabled')
      )
      loadConfigs()
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('merchant.recommendations.config.toggleFailed', 'Failed to toggle configuration: ') + errorMsg)
    }
  }

  const handleDeleteConfig = async (config: ABTestConfig) => {
    if (!confirm(getText('merchant.recommendations.config.deleteConfirm', 'Are you sure you want to delete this configuration?'))) {
      return
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/recommendations/ab-config/${config.id}`, {
      //   method: 'DELETE'
      // })

      toast.success(getText('merchant.recommendations.config.deleteSuccess', 'Configuration deleted successfully'))
      loadConfigs()
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('merchant.recommendations.config.deleteFailed', 'Failed to delete configuration: ') + errorMsg)
    }
  }

  const openEditDialog = (config: ABTestConfig) => {
    setEditingConfig(config)
    setFormData({
      name: config.name,
      recommendationType: config.recommendationType,
      algorithm: config.algorithm,
      isActive: config.isActive,
      trafficPercentage: config.trafficPercentage,
      priority: config.priority,
      parameters: config.parameters || {}
    })
    setShowCreateDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      recommendationType: 'customers-also-bought',
      algorithm: '',
      isActive: true,
      trafficPercentage: 100,
      priority: 0,
      parameters: {}
    })
    setEditingConfig(null)
  }

  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingConfig) {
      await handleUpdateConfig(editingConfig)
    } else {
      await handleCreateConfig()
    }
  }

  const getTypeLabel = (type: string) => {
    const labels = {
      'customers-also-bought': getText('merchant.recommendations.type.customersAlsoBought', 'Customers Also Bought'),
      'frequently-bought-together': getText('merchant.recommendations.type.frequentlyBought', 'Frequently Bought Together'),
      'personalized': getText('merchant.recommendations.type.personalized', 'Personalized'),
    }
    return labels[type as keyof typeof labels] || type
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getText('merchant.recommendations.config.title', 'A/B Testing Configuration')}
            </h2>
            <p className="text-sm text-gray-600">
              {getText('merchant.recommendations.config.description', 'Configure and manage recommendation algorithm tests')}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          {getText('merchant.recommendations.config.create', 'New Configuration')}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <Label className="text-sm font-medium text-gray-700">
          {getText('merchant.recommendations.config.filterByType', 'Filter by Type:')}
        </Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getText('common.all', 'All Types')}</SelectItem>
            <SelectItem value="customers-also-bought">{getTypeLabel('customers-also-bought')}</SelectItem>
            <SelectItem value="frequently-bought-together">{getTypeLabel('frequently-bought-together')}</SelectItem>
            <SelectItem value="personalized">{getTypeLabel('personalized')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Configurations List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">{getText('common.loading', 'Loading...')}</p>
          </div>
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getText('merchant.recommendations.config.noConfigs', 'No configurations found')}
            </h3>
            <p className="text-gray-600 mb-4">
              {getText('merchant.recommendations.config.noConfigsDescription', 'Create your first A/B test configuration to get started')}
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              {getText('merchant.recommendations.config.create', 'New Configuration')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{config.name}</h3>
                      <Badge variant={config.isActive ? 'default' : 'secondary'}>
                        {config.isActive
                          ? getText('merchant.recommendations.config.active', 'Active')
                          : getText('merchant.recommendations.config.inactive', 'Inactive')}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <span>
                          <span className="font-medium">{getText('merchant.recommendations.config.type', 'Type:')}</span>{' '}
                          {getTypeLabel(config.recommendationType)}
                        </span>
                        <span>
                          <span className="font-medium">{getText('merchant.recommendations.config.algorithm', 'Algorithm:')}</span>{' '}
                          {config.algorithm}
                        </span>
                      </div>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <span>
                          <span className="font-medium">{getText('merchant.recommendations.config.traffic', 'Traffic:')}</span>{' '}
                          {config.trafficPercentage}%
                        </span>
                        <span>
                          <span className="font-medium">{getText('merchant.recommendations.config.priority', 'Priority:')}</span>{' '}
                          {config.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`toggle-${config.id}`} className="text-sm text-gray-700">
                        {config.isActive
                          ? getText('merchant.recommendations.config.enabled', 'Enabled')
                          : getText('merchant.recommendations.config.disabled', 'Disabled')}
                      </Label>
                      <Switch
                        id={`toggle-${config.id}`}
                        checked={config.isActive}
                        onCheckedChange={() => handleToggleActive(config)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(config)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {getText('common.actions.edit', 'Edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteConfig(config)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {getText('common.actions.delete', 'Delete')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingConfig
                ? getText('merchant.recommendations.config.editTitle', 'Edit Configuration')
                : getText('merchant.recommendations.config.createTitle', 'Create Configuration')}
            </DialogTitle>
            <DialogDescription>
              {editingConfig
                ? getText('merchant.recommendations.config.editDescription', 'Update A/B test configuration settings')
                : getText('merchant.recommendations.config.createDescription', 'Create a new A/B test configuration for recommendation algorithms')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{getText('merchant.recommendations.config.name', 'Configuration Name')}</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={getText('merchant.recommendations.config.namePlaceholder', 'e.g., Enhanced Collaborative Filtering')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recommendationType">{getText('merchant.recommendations.config.type', 'Type')}</Label>
                  <Select
                    value={formData.recommendationType}
                    onValueChange={(value: any) => setFormData({ ...formData, recommendationType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customers-also-bought">{getTypeLabel('customers-also-bought')}</SelectItem>
                      <SelectItem value="frequently-bought-together">{getTypeLabel('frequently-bought-together')}</SelectItem>
                      <SelectItem value="personalized">{getTypeLabel('personalized')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="algorithm">{getText('merchant.recommendations.config.algorithm', 'Algorithm')}</Label>
                  <Input
                    id="algorithm"
                    type="text"
                    value={formData.algorithm}
                    onChange={(e) => setFormData({ ...formData, algorithm: e.target.value })}
                    placeholder={getText('merchant.recommendations.config.algorithmPlaceholder', 'e.g., collaborative-filtering-v2')}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trafficPercentage">{getText('merchant.recommendations.config.traffic', 'Traffic Percentage')}</Label>
                  <Input
                    id="trafficPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.trafficPercentage}
                    onChange={(e) => setFormData({ ...formData, trafficPercentage: parseInt(e.target.value) || 0 })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    {getText('merchant.recommendations.config.trafficHint', 'Percentage of traffic to route to this configuration')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">{getText('merchant.recommendations.config.priority', 'Priority')}</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    {getText('merchant.recommendations.config.priorityHint', 'Higher priority configs are selected first')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {getText('merchant.recommendations.config.activeOnCreate', 'Enable this configuration immediately')}
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                {getText('common.actions.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving
                  ? getText('common.actions.saving', 'Saving...')
                  : editingConfig
                  ? getText('common.actions.update', 'Update')
                  : getText('common.actions.create', 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
