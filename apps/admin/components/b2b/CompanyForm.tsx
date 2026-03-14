/**
 * Company Form Dialog Component
 *
 * Handles create, edit, and delete operations for companies
 * Displays as a dialog with appropriate forms
 */

'use client'

import { useState, useEffect } from 'react'
import { useT } from 'shared/src/i18n/react'
import { useCreateCompany, useUpdateCompany, useDeleteCompany, type Company } from '@/lib/hooks/use-api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  company?: Company | null
  mode: 'create' | 'edit' | 'delete'
}

export function CompanyForm({ open, onOpenChange, onSuccess, company, mode }: CompanyFormProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const createMutation = useCreateCompany()
  const updateMutation = useUpdateCompany()
  const deleteMutation = useDeleteCompany()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    website: '',
    description: '',
    industry: '',
    employeeCount: '',
    annualRevenue: '',
    accountType: 'STANDARD',
    accountStatus: 'PENDING',
    paymentTerms: 'IMMEDIATE',
    creditLimit: 0,
    taxExempt: false,
    taxExemptionId: '',
    discountPercent: 0,
    billingAddress1: '',
    billingAddress2: '',
    billingCity: '',
    billingState: '',
    billingCountry: '',
    billingPostalCode: '',
  })

  // Reset form when dialog opens/closes or company changes
  useEffect(() => {
    if (open && mode === 'edit' && company) {
      setFormData({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        taxId: company.taxId || '',
        website: company.website || '',
        description: company.description || '',
        industry: company.industry || '',
        employeeCount: company.employeeCount || '',
        annualRevenue: company.annualRevenue || '',
        accountType: company.accountType || 'STANDARD',
        accountStatus: company.accountStatus || 'PENDING',
        paymentTerms: company.paymentTerms || 'IMMEDIATE',
        creditLimit: company.creditLimit || 0,
        taxExempt: company.taxExempt || false,
        taxExemptionId: company.taxExemptionId || '',
        discountPercent: company.discountPercent || 0,
        billingAddress1: company.billingAddress1 || '',
        billingAddress2: company.billingAddress2 || '',
        billingCity: company.billingCity || '',
        billingState: company.billingState || '',
        billingCountry: company.billingCountry || '',
        billingPostalCode: company.billingPostalCode || '',
      })
    } else if (open && mode === 'create') {
      setFormData({
        name: '',
        email: '',
        phone: '',
        taxId: '',
        website: '',
        description: '',
        industry: '',
        employeeCount: '',
        annualRevenue: '',
        accountType: 'STANDARD',
        accountStatus: 'PENDING',
        paymentTerms: 'IMMEDIATE',
        creditLimit: 0,
        taxExempt: false,
        taxExemptionId: '',
        discountPercent: 0,
        billingAddress1: '',
        billingAddress2: '',
        billingCity: '',
        billingState: '',
        billingCountry: '',
        billingPostalCode: '',
      })
    }
  }, [open, mode, company])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData as any)
      } else if (mode === 'edit' && company) {
        await updateMutation.mutateAsync({ id: company.id, data: formData as any })
      } else if (mode === 'delete' && company) {
        await deleteMutation.mutateAsync(company.id)
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      // Error is handled by the mutation hooks with toast
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  // Delete confirmation dialog
  if (mode === 'delete') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getText('merchant.b2b.companies.delete.title', 'Delete Company')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.b2b.companies.delete.description', 'Are you sure you want to delete this company? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700">
              {getText('merchant.b2b.companies.delete.companyName', 'Company')}: <strong>{company?.name}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {getText('merchant.b2b.companies.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getText('merchant.b2b.companies.delete.confirm', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Create/Edit form dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? getText('merchant.b2b.companies.create.title', 'Create Company')
              : getText('merchant.b2b.companies.edit.title', 'Edit Company')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? getText('merchant.b2b.companies.create.description', 'Add a new business customer account.')
              : getText('merchant.b2b.companies.edit.description', 'Update company information.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.companies.basicInfo', 'Basic Information')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {getText('merchant.b2b.companies.form.name', 'Company Name')} *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {getText('merchant.b2b.companies.form.email', 'Email')} *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {getText('merchant.b2b.companies.form.phone', 'Phone')}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">
                    {getText('merchant.b2b.companies.form.taxId', 'Tax ID')}
                  </Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">
                  {getText('merchant.b2b.companies.form.website', 'Website')}
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </div>

            {/* Account Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                {getText('merchant.b2b.companies.accountSettings', 'Account Settings')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountType">
                    {getText('merchant.b2b.companies.form.accountType', 'Account Type')}
                  </Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountStatus">
                    {getText('merchant.b2b.companies.form.accountStatus', 'Account Status')}
                  </Label>
                  <Select
                    value={formData.accountStatus}
                    onValueChange={(value) => setFormData({ ...formData, accountStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">
                    {getText('merchant.b2b.companies.form.paymentTerms', 'Payment Terms')}
                  </Label>
                  <Select
                    value={formData.paymentTerms}
                    onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                      <SelectItem value="NET15">Net 15</SelectItem>
                      <SelectItem value="NET30">Net 30</SelectItem>
                      <SelectItem value="NET60">Net 60</SelectItem>
                      <SelectItem value="NET90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">
                    {getText('merchant.b2b.companies.form.creditLimit', 'Credit Limit')}
                  </Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">
                    {getText('merchant.b2b.companies.form.discountPercent', 'Discount %')}
                  </Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {getText('merchant.b2b.companies.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create'
                ? getText('merchant.b2b.companies.create.submit', 'Create Company')
                : getText('merchant.b2b.companies.edit.submit', 'Update Company')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
