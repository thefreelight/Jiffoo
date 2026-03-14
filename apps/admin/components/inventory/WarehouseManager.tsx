/**
 * Warehouse Manager Component
 *
 * Provides UI for managing warehouses: create, edit, delete, and set default.
 * Displays warehouse list with stats and inventory details.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, Building2, CheckCircle, Edit, MapPin, Pencil, Plus, Star, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { warehouseApi } from '@/lib/api/inventory'
import { unwrapApiResponse } from '@/lib/api'
import type { Warehouse } from 'shared'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

interface WarehouseManagerProps {
  warehouses: Warehouse[]
  onRefresh: () => void
}

interface WarehouseFormData {
  name: string
  code: string
  address: string
  isActive: boolean
  isDefault: boolean
}

export function WarehouseManager({ warehouses, onRefresh }: WarehouseManagerProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState<WarehouseFormData>({
    name: '',
    code: '',
    address: '',
    isActive: true,
    isDefault: false,
  })

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      isActive: true,
      isDefault: false,
    })
  }

  const handleCreate = () => {
    resetForm()
    setIsCreateOpen(true)
  }

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || '',
      isActive: warehouse.isActive,
      isDefault: warehouse.isDefault,
    })
    setIsEditOpen(true)
  }

  const handleDelete = async (warehouse: Warehouse) => {
    if (warehouse.isDefault) {
      toast.error(getText('merchant.warehouses.cannotDeleteDefault', 'Cannot delete the default warehouse'))
      return
    }

    if (!window.confirm(getText('merchant.warehouses.deleteConfirm', `Are you sure you want to delete warehouse "${warehouse.name}"? This action cannot be undone.`))) {
      return
    }

    try {
      setIsSubmitting(true)
      const response = await warehouseApi.delete(warehouse.id)
      if (response.success) {
        toast.success(getText('merchant.warehouses.deleteSuccess', 'Warehouse deleted successfully'))
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete warehouse:', error)
      toast.error(getText('merchant.warehouses.deleteFailed', 'Failed to delete warehouse'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetDefault = async (warehouse: Warehouse) => {
    if (warehouse.isDefault) return

    try {
      setIsSubmitting(true)
      const response = await warehouseApi.setDefault(warehouse.id)
      if (response.success) {
        toast.success(getText('merchant.warehouses.setDefaultSuccess', 'Default warehouse updated successfully'))
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to set default warehouse:', error)
      toast.error(getText('merchant.warehouses.setDefaultFailed', 'Failed to set default warehouse'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error(getText('merchant.warehouses.requiredFields', 'Please fill in all required fields'))
      return
    }

    try {
      setIsSubmitting(true)
      const response = await warehouseApi.create(formData)
      if (response.success) {
        toast.success(getText('merchant.warehouses.createSuccess', 'Warehouse created successfully'))
        setIsCreateOpen(false)
        resetForm()
        onRefresh()
      }
    } catch (error: any) {
      console.error('Failed to create warehouse:', error)
      toast.error(error?.message || getText('merchant.warehouses.createFailed', 'Failed to create warehouse'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingWarehouse || !formData.name.trim() || !formData.code.trim()) {
      toast.error(getText('merchant.warehouses.requiredFields', 'Please fill in all required fields'))
      return
    }

    try {
      setIsSubmitting(true)
      const response = await warehouseApi.update(editingWarehouse.id, formData)
      if (response.success) {
        toast.success(getText('merchant.warehouses.updateSuccess', 'Warehouse updated successfully'))
        setIsEditOpen(false)
        setEditingWarehouse(null)
        resetForm()
        onRefresh()
      }
    } catch (error: any) {
      console.error('Failed to update warehouse:', error)
      toast.error(error?.message || getText('merchant.warehouses.updateFailed', 'Failed to update warehouse'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {getText('merchant.warehouses.list', 'Warehouse List')}
          </h2>
          <p className="text-sm text-gray-600">
            {getText('merchant.warehouses.listSubtitle', 'Manage your warehouse locations and inventory')}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isSubmitting}>
          <Plus className="h-4 w-4 mr-2" />
          {getText('merchant.warehouses.addWarehouse', 'Add Warehouse')}
        </Button>
      </div>

      {/* Warehouse List */}
      {warehouses.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {getText('merchant.warehouses.noWarehouses', 'No warehouses yet')}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {getText('merchant.warehouses.createFirst', 'Create your first warehouse')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <WarehouseIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {warehouse.name}
                        {warehouse.isDefault && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <Star className="h-3 w-3 mr-1 fill-amber-800" />
                            {getText('merchant.warehouses.default', 'Default')}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {getText('merchant.warehouses.code', 'Code')}: {warehouse.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!warehouse.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(warehouse)}
                        disabled={isSubmitting}
                        title={getText('merchant.warehouses.setAsDefault', 'Set as default')}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(warehouse)}
                      disabled={isSubmitting}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!warehouse.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(warehouse)}
                        disabled={isSubmitting}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {warehouse.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{warehouse.address}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {getText('merchant.warehouses.status', 'Status')}:
                      </span>
                      {warehouse.isActive ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {getText('merchant.warehouses.active', 'Active')}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                          {getText('merchant.warehouses.inactive', 'Inactive')}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(warehouse.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {getText('merchant.warehouses.createTitle', 'Create New Warehouse')}
            </DialogTitle>
            <DialogDescription>
              {getText('merchant.warehouses.createDescription', 'Add a new warehouse location to manage inventory')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">
                  {getText('merchant.warehouses.name', 'Name')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={getText('merchant.warehouses.namePlaceholder', 'Main Warehouse')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-code">
                  {getText('merchant.warehouses.code', 'Code')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={getText('merchant.warehouses.codePlaceholder', 'WH-MAIN')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-address">
                  {getText('merchant.warehouses.address', 'Address')}
                </Label>
                <Textarea
                  id="create-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={getText('merchant.warehouses.addressPlaceholder', '123 Storage St, City, State')}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="create-active">
                  {getText('merchant.warehouses.active', 'Active')}
                </Label>
                <Switch
                  id="create-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="create-default">
                  {getText('merchant.warehouses.setAsDefault', 'Set as default warehouse')}
                </Label>
                <Switch
                  id="create-default"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                {getText('merchant.warehouses.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? getText('merchant.warehouses.creating', 'Creating...') : getText('merchant.warehouses.create', 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {getText('merchant.warehouses.editTitle', 'Edit Warehouse')}
            </DialogTitle>
            <DialogDescription>
              {getText('merchant.warehouses.editDescription', 'Update warehouse information')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  {getText('merchant.warehouses.name', 'Name')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">
                  {getText('merchant.warehouses.code', 'Code')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">
                  {getText('merchant.warehouses.address', 'Address')}
                </Label>
                <Textarea
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">
                  {getText('merchant.warehouses.active', 'Active')}
                </Label>
                <Switch
                  id="edit-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
              {!editingWarehouse?.isDefault && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-default">
                    {getText('merchant.warehouses.setAsDefault', 'Set as default warehouse')}
                  </Label>
                  <Switch
                    id="edit-default"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                {getText('merchant.warehouses.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? getText('merchant.warehouses.saving', 'Saving...') : getText('merchant.warehouses.save', 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
