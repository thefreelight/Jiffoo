/**
 * Tenants Management Page - Super Admin
 *
 * 列表只做入口：搜索/筛选、统计卡片、进入详情页
 * 所有操作（编辑、状态切换、删除）统一在详情页 /tenants/[id] 进行
 */
'use client'

import { Building2, CheckCircle, Clock, Eye, Plus, Search, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { tenantManagementApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'

interface Tenant {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  agencyLevel: 'basic' | 'industry' | 'global'
  // 状态统一使用大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
  domain?: string
  subdomain?: string
  createdAt: string
  activatedAt?: string
  userCount?: number
  productCount?: number
  orderCount?: number
}

export default function TenantsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agencyLevelFilter, setAgencyLevelFilter] = useState<string>('all')

  // Add tenant dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    agencyLevel: 'basic',
    adminUsername: '',
    adminEmail: '',
    adminPassword: ''
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      // 状态筛选使用大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
      const response = await tenantManagementApi.getAllTenants({
        limit: 100,
        status: statusFilter !== 'all' ? statusFilter as 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' : undefined,
        agencyLevel: agencyLevelFilter !== 'all' ? agencyLevelFilter : undefined
      })

      // apiClient.get() 返回的是后端响应的 JSON 对象 { success, data, pagination }
      // 所以 response.data 就是租户数组，status 已经是大写
      const tenantsData: Tenant[] = Array.isArray(response.data) ? response.data : []
      console.log('Tenants data:', tenantsData)
      setTenants(tenantsData)
    } catch (error) {
      console.error('Failed to fetch tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    // 数据库存储的 status 是大写 (ACTIVE, PENDING, SUSPENDED)
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'SUSPENDED':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    // 数据库存储的 status 是大写 (ACTIVE, PENDING, SUSPENDED)
    switch (status) {
      case 'ACTIVE':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'PENDING':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'SUSPENDED':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getAgencyLevelBadge = (level: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (level) {
      case 'global':
        return `${baseClasses} bg-purple-100 text-purple-800`
      case 'industry':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'basic':
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
    // 筛选条件使用大写状态
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
    const matchesAgencyLevel = agencyLevelFilter === 'all' || tenant.agencyLevel === agencyLevelFilter
    
    return matchesSearch && matchesStatus && matchesAgencyLevel
  })

  // 所有状态操作（激活、暂停、终止、删除）已移至详情页 /tenants/[id]

  const handleCreateTenant = async () => {
    // Validate form - contactName is required by API
    if (!createForm.companyName || !createForm.contactName || !createForm.contactEmail || !createForm.adminEmail || !createForm.adminUsername || !createForm.adminPassword) {
      alert(t('tenants.form.required_fields', 'Please fill in all required fields'))
      return
    }

    try {
      setCreating(true)
      const response = await tenantManagementApi.createTenant({
        companyName: createForm.companyName,
        contactName: createForm.contactName,
        contactEmail: createForm.contactEmail,
        contactPhone: createForm.contactPhone || undefined,
        agencyLevel: createForm.agencyLevel,
        adminUser: {
          username: createForm.adminUsername,
          email: createForm.adminEmail,
          password: createForm.adminPassword
        }
      })

      if (response.success) {
        setShowAddDialog(false)
        // Reset form
        setCreateForm({
          companyName: '',
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          agencyLevel: 'basic',
          adminUsername: '',
          adminEmail: '',
          adminPassword: ''
        })
        fetchTenants() // Refresh the list
        alert(t('tenants.create_success', 'Tenant created successfully'))
      } else {
        alert(response.message || t('tenants.create_failed', 'Failed to create tenant'))
      }
    } catch (error: any) {
      console.error('Failed to create tenant:', error)
      alert(error.message || t('tenants.create_failed', 'Failed to create tenant'))
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
            <p className="text-gray-600 mt-2">Manage all platform tenants</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('tenants.title', 'Tenant Management')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('tenants.description', 'Manage all platform tenants and their configurations')}
          </p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('tenants.add_tenant', 'Add Tenant')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={t('tenants.search_placeholder', 'Search tenants...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            
            <select
              value={agencyLevelFilter}
              onChange={(e) => setAgencyLevelFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="basic">Basic</option>
              <option value="industry">Industry</option>
              <option value="global">Global</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tenants.filter(t => t.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tenants.filter(t => t.status === 'PENDING').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Suspended</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tenants.filter(t => t.status === 'SUSPENDED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('tenants.list_title', 'All Tenants')} ({filteredTenants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTenants.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' || agencyLevelFilter !== 'all' 
                  ? t('tenants.no_results', 'No tenants match your filters')
                  : t('tenants.no_tenants', 'No tenants found')
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/tenants/${tenant.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {tenant.companyName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {tenant.domain || tenant.subdomain}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tenant.contactName}</div>
                        <div className="text-sm text-gray-500">{tenant.contactEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(tenant.status)}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getAgencyLevelBadge(tenant.agencyLevel)}>
                          {tenant.agencyLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/tenants/${tenant.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tenant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('tenants.add_tenant', 'Add New Tenant')}</DialogTitle>
            <DialogDescription>
              {t('tenants.add_description', 'Create a new tenant with an admin user account.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Company Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700">{t('tenants.form.company_info', 'Company Information')}</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t('tenants.form.company_name', 'Company Name')} *</Label>
                  <Input
                    id="companyName"
                    value={createForm.companyName}
                    onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                    placeholder={t('tenants.form.company_name_placeholder', 'Enter company name')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactName">{t('tenants.form.contact_name', 'Contact Name')} *</Label>
                  <Input
                    id="contactName"
                    value={createForm.contactName}
                    onChange={(e) => setCreateForm({ ...createForm, contactName: e.target.value })}
                    placeholder={t('tenants.form.contact_name_placeholder', 'Enter contact person name')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t('tenants.form.contact_email', 'Contact Email')} *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={createForm.contactEmail}
                    onChange={(e) => setCreateForm({ ...createForm, contactEmail: e.target.value })}
                    placeholder={t('tenants.form.contact_email_placeholder', 'contact@company.com')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">{t('tenants.form.contact_phone', 'Contact Phone')}</Label>
                  <Input
                    id="contactPhone"
                    value={createForm.contactPhone}
                    onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                    placeholder={t('tenants.form.contact_phone_placeholder', '+1234567890')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agencyLevel">{t('tenants.form.agency_level', 'Agency Level')}</Label>
                <select
                  id="agencyLevel"
                  value={createForm.agencyLevel}
                  onChange={(e) => setCreateForm({ ...createForm, agencyLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic</option>
                  <option value="industry">Industry</option>
                  <option value="global">Global</option>
                </select>
              </div>
            </div>

            {/* Admin User Information */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">{t('tenants.form.admin_info', 'Admin User Information')}</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername">{t('tenants.form.admin_username', 'Admin Username')} *</Label>
                  <Input
                    id="adminUsername"
                    value={createForm.adminUsername}
                    onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })}
                    placeholder={t('tenants.form.admin_username_placeholder', 'admin')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">{t('tenants.form.admin_email', 'Admin Email')} *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    placeholder={t('tenants.form.admin_email_placeholder', 'admin@company.com')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">{t('tenants.form.admin_password', 'Admin Password')} *</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={createForm.adminPassword}
                  onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                  placeholder={t('tenants.form.admin_password_placeholder', 'Enter a secure password')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={creating}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleCreateTenant} disabled={creating} className="bg-blue-600 hover:bg-blue-700">
              {creating ? t('common.creating', 'Creating...') : t('tenants.create_tenant', 'Create Tenant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
