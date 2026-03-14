/**
 * Redirect Manager Component
 *
 * Reusable component for managing SEO redirects.
 * Displays a table of redirects with add/edit/delete functionality.
 */

'use client'

import { AlertTriangle, Plus, Search, Trash2, Pencil, TrendingUp, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRedirects, useCreateRedirect, useUpdateRedirect, useDeleteRedirect, type SeoRedirect } from '@/lib/hooks/use-api'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from 'shared/src/i18n/react'

interface RedirectManagerProps {
  className?: string
}

export function RedirectManager({ className }: RedirectManagerProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingRedirect, setEditingRedirect] = useState<SeoRedirect | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    fromPath: '',
    toPath: '',
    statusCode: 301,
    isActive: true,
  })

  // API hooks
  const {
    data: redirectsData,
    isLoading,
    error,
    refetch
  } = useRedirects({
    page: currentPage,
    limit: pageSize,
    search: searchTerm
  })

  const createMutation = useCreateRedirect()
  const updateMutation = useUpdateRedirect()
  const deleteMutation = useDeleteRedirect()

  const redirects = redirectsData?.data || []
  const pagination = redirectsData?.pagination

  const handleAddRedirect = () => {
    setFormData({
      fromPath: '',
      toPath: '',
      statusCode: 301,
      isActive: true,
    })
    setEditingRedirect(null)
    setShowAddDialog(true)
  }

  const handleEditRedirect = (redirect: SeoRedirect) => {
    setFormData({
      fromPath: redirect.fromPath,
      toPath: redirect.toPath,
      statusCode: redirect.statusCode,
      isActive: redirect.isActive,
    })
    setEditingRedirect(redirect)
    setShowAddDialog(true)
  }

  const handleSaveRedirect = async () => {
    try {
      if (editingRedirect) {
        await updateMutation.mutateAsync({
          id: editingRedirect.id,
          data: formData
        })
      } else {
        await createMutation.mutateAsync(formData)
      }
      setShowAddDialog(false)
      await refetch()
    } catch (error) {
      // Error is handled by mutation hooks
    }
  }

  const handleDeleteRedirect = async (id: string) => {
    if (window.confirm(getText('admin.seo.deleteConfirm', 'Are you sure you want to delete this redirect?'))) {
      try {
        await deleteMutation.mutateAsync(id)
        await refetch()
      } catch (error) {
        // Error is handled by mutation hook
      }
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
        {getText('admin.seo.active', 'Active')}
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
        {getText('admin.seo.inactive', 'Inactive')}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('admin.seo.loading', 'Loading redirects...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('admin.seo.loadFailed', 'Failed to load redirects')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
          >
            {getText('admin.seo.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Filters and Add Button */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={getText('admin.seo.searchPlaceholder', 'Search redirects by path...')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <Button className="bg-gray-900 hover:bg-gray-800" onClick={handleAddRedirect}>
            <Plus className="w-4 h-4 mr-2" />
            {getText('admin.seo.addRedirect', 'Add Redirect')}
          </Button>
        </div>
      </div>

      {/* Redirects Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.fromPath', 'From Path')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.toPath', 'To Path')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.statusCode', 'Status Code')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.hits', 'Hits')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.status', 'Status')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {getText('admin.seo.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {redirects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {getText('admin.seo.noRedirects', 'No redirects found')}
                </td>
              </tr>
            ) : (
              redirects.map((redirect) => (
                <tr key={redirect.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <code className="text-sm font-mono text-gray-900">{redirect.fromPath}</code>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <code className="text-sm font-mono text-gray-900">{redirect.toPath}</code>
                      <ExternalLink className="w-3 h-3 ml-2 text-gray-400" />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      redirect.statusCode === 301
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {redirect.statusCode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <TrendingUp className="w-4 h-4 mr-1 text-gray-400" />
                      {redirect.hitCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(redirect.isActive)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditRedirect(redirect)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRedirect(redirect.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {getText('admin.seo.showing', 'Showing')} {((currentPage - 1) * pageSize) + 1} {getText('admin.seo.to', 'to')} {Math.min(currentPage * pageSize, pagination.total)} {getText('admin.seo.of', 'of')} {pagination.total} {getText('admin.seo.results', 'results')}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {getText('admin.seo.previous', 'Previous')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
            >
              {getText('admin.seo.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRedirect
                ? getText('admin.seo.editRedirect', 'Edit Redirect')
                : getText('admin.seo.addRedirect', 'Add Redirect')
              }
            </DialogTitle>
            <DialogDescription>
              {getText('admin.seo.redirectDescription', 'Create a 301 or 302 redirect to improve SEO and user experience')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fromPath">{getText('admin.seo.fromPath', 'From Path')}</Label>
              <Input
                id="fromPath"
                placeholder="/old-url"
                value={formData.fromPath}
                onChange={(e) => setFormData({ ...formData, fromPath: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toPath">{getText('admin.seo.toPath', 'To Path')}</Label>
              <Input
                id="toPath"
                placeholder="/new-url"
                value={formData.toPath}
                onChange={(e) => setFormData({ ...formData, toPath: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusCode">{getText('admin.seo.statusCode', 'Status Code')}</Label>
              <Select
                value={formData.statusCode.toString()}
                onValueChange={(value) => setFormData({ ...formData, statusCode: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 - {getText('admin.seo.permanent', 'Permanent')}</SelectItem>
                  <SelectItem value="302">302 - {getText('admin.seo.temporary', 'Temporary')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">{getText('admin.seo.activeRedirect', 'Active (redirect is enabled)')}</Label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {getText('admin.seo.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSaveRedirect}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.fromPath || !formData.toPath}
            >
              {editingRedirect
                ? getText('admin.seo.updateRedirect', 'Update Redirect')
                : getText('admin.seo.createRedirect', 'Create Redirect')
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
