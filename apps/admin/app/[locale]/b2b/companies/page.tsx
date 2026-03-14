/**
 * Companies Page for B2B Admin
 *
 * Displays company list with search, filter, and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { AlertTriangle, Building2, Search, Plus, Edit, Trash2, Eye } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useCompanies, type Company } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'
import { CompanyForm } from '@/components/b2b/CompanyForm'
import { useToast } from '@/hooks/use-toast'


export default function CompaniesPage() {
  const t = useT()
  const locale = useLocale()
  const { toast } = useToast()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Companies module
  const navItems = [
    { label: getText('merchant.b2b.companies.allCompanies', 'All Companies'), href: '/b2b/companies', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  // API hooks - Call real backend API, fetch all companies
  const {
    data: companiesResponse,
    isLoading,
    error,
    refetch
  } = useCompanies({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })

  // Extract data from API response
  const companies = companiesResponse?.data || []
  const pagination = companiesResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  }

  // Filter companies locally for immediate feedback
  const filteredCompanies = companies.filter((company: Company) => {
    if (!company) return false

    const matchesSearch = searchTerm === '' ||
      company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = selectedStatus === 'All' || company.accountStatus === selectedStatus

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'ENTERPRISE':
        return 'bg-purple-100 text-purple-800'
      case 'PREMIUM':
        return 'bg-blue-100 text-blue-800'
      case 'STANDARD':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Operation success callback
  const handleOperationSuccess = (message: string) => {
    toast({
      title: getText('merchant.b2b.companies.success', 'Operation Successful'),
      description: message,
    })
    refetch()
  }

  // Open edit dialog
  const handleEdit = (company: Company) => {
    setSelectedCompany(company)
    setEditDialogOpen(true)
  }

  // Open delete dialog
  const handleDelete = (company: Company) => {
    setSelectedCompany(company)
    setDeleteDialogOpen(true)
  }

  // Calculate stats from companies data
  const companyStats = {
    total: pagination.total,
    active: companies.filter((c: Company) => c.accountStatus === 'ACTIVE').length,
    pending: companies.filter((c: Company) => c.accountStatus === 'PENDING').length,
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.b2b.companies.loadFailed', 'Failed to load companies')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('merchant.b2b.companies.loadError', 'Error: {message}').replace('{message}', error instanceof Error ? error.message : getText('merchant.b2b.companies.unknown', 'Unknown'))}
              </p>
              <Button onClick={() => refetch()}>{getText('merchant.b2b.companies.tryAgain', 'Try Again')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.b2b.companies.title', 'B2B Companies')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.b2b.companies.subtitle', 'Manage your business customer accounts')}</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {getText('merchant.b2b.companies.addCompany', 'Add Company')}
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.companies.totalCompanies', 'Total Companies')}</p>
                <p className="text-2xl font-bold text-gray-900">{companyStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.companies.active', 'Active')}</p>
                <p className="text-2xl font-bold text-green-600">{companyStats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.companies.pending', 'Pending')}</p>
                <p className="text-2xl font-bold text-yellow-600">{companyStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={getText('merchant.b2b.companies.searchPlaceholder', 'Search companies by name or email...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.b2b.companies.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.b2b.companies.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="ACTIVE">{getText('merchant.b2b.companies.statusActive', 'Active')}</SelectItem>
                  <SelectItem value="PENDING">{getText('merchant.b2b.companies.statusPending', 'Pending')}</SelectItem>
                  <SelectItem value="SUSPENDED">{getText('merchant.b2b.companies.statusSuspended', 'Suspended')}</SelectItem>
                  <SelectItem value="CLOSED">{getText('merchant.b2b.companies.statusClosed', 'Closed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.name', 'Company')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.contact', 'Contact')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.accountType', 'Account Type')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.creditLimit', 'Credit Limit')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.companies.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? getText('merchant.b2b.companies.noCompaniesMatching', 'No companies found matching your search.') : getText('merchant.b2b.companies.noCompaniesFound', 'No companies found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company: Company) => (
                    <tr key={company.id} className="hover:bg-gray-50">

                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full mr-4 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{company.name || getText('merchant.b2b.companies.unknown', 'Unknown')}</div>
                            <div className="text-sm text-gray-500">{company.taxId || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm">
                          <div className="text-gray-900">{company.email || getText('merchant.b2b.companies.noEmail', 'No email')}</div>
                          <div className="text-gray-500">{company.phone || getText('merchant.b2b.companies.noPhone', 'No phone')}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getAccountTypeColor(company.accountType)}>
                          {company.accountType}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        ${company.creditLimit.toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getStatusColor(company.accountStatus)}>
                          {company.accountStatus}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Link href={`/${locale}/b2b/companies/${company.id}`}>
                            <Button variant="ghost" size="sm" title={getText('merchant.b2b.companies.viewDetails', 'View Details')}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.companies.edit', 'Edit')}
                            onClick={() => handleEdit(company)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.companies.delete', 'Delete')}
                            onClick={() => handleDelete(company)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.b2b.companies.showingResults', 'Showing {from} to {to} of {total} results')
              .replace('{from}', String((currentPage - 1) * pageSize + 1))
              .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
              .replace('{total}', String(pagination.total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.b2b.companies.previous', 'Previous')}
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('merchant.b2b.companies.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog components */}
      <CompanyForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.companies.create.success', 'Company created successfully'))}
        mode="create"
      />

      <CompanyForm
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.companies.edit.success', 'Company updated successfully'))}
        company={selectedCompany}
        mode="edit"
      />

      <CompanyForm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.companies.delete.success', 'Company deleted successfully'))}
        company={selectedCompany}
        mode="delete"
      />
    </div>
  )
}
