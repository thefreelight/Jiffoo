'use client'

import { ArrowLeft, Building2, Check, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tenantManagementApi } from '@/lib/api'
import { showSuccess, showError } from '@/lib/utils'
// Removed I18n import

interface TenantEditForm {
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  address: string
  agencyLevel: string
  domain: string
  subdomain: string
}

export default function TenantEditPage() {
  // Removed useI18n hook
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string
  
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<TenantEditForm>({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    agencyLevel: 'Basic',
    domain: '',
    subdomain: ''
  })

  const fetchTenantDetails = useCallback(async () => {
    try {
      setLoading(true)
      const response = await tenantManagementApi.getTenant(tenantId)
      const tenantData = response.data.tenant || response.data
      
      setTenant(tenantData)
      setFormData({
        companyName: tenantData.companyName || '',
        contactName: tenantData.contactName || '',
        contactEmail: tenantData.contactEmail || '',
        contactPhone: tenantData.contactPhone || '',
        address: tenantData.address || '',
        agencyLevel: tenantData.agencyLevel || 'Basic',
        domain: tenantData.domain || '',
        subdomain: tenantData.subdomain || ''
      })
    } catch (error) {
      console.error('Failed to fetch tenant details:', error)
      showError('Failed to load tenant details')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) {
      fetchTenantDetails()
    }
  }, [tenantId, fetchTenantDetails])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      await tenantManagementApi.updateTenant(tenantId, formData)
      showSuccess('Tenant updated successfully')
      router.push('/tenants')
    } catch (error) {
      console.error('Failed to update tenant:', error)
      showError('Failed to update tenant')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof TenantEditForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Tenant not found</p>
        <Button 
          variant="outline" 
          onClick={() => router.push('/tenants')}
          className="mt-4"
        >
          Back to Tenants
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/tenants')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Tenant: {tenant.companyName}
            </h1>
            <p className="text-gray-600 mt-2">
              Update tenant information and settings
            </p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange('contactName', e.target.value)}
                  placeholder="Enter contact person name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  placeholder="Enter contact email"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  placeholder="Enter contact phone"
                />
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter company address"
                />
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="agencyLevel">Agency Level</Label>
                <Select 
                  value={formData.agencyLevel} 
                  onValueChange={(value) => handleInputChange('agencyLevel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agency level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Industry">Industry</SelectItem>
                    <SelectItem value="Global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => handleInputChange('domain', e.target.value)}
                  placeholder="Enter custom domain"
                />
              </div>
              
              <div>
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) => handleInputChange('subdomain', e.target.value)}
                  placeholder="Enter subdomain"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => router.push('/tenants')}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Check className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
