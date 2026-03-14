/**
 * Company List Component
 *
 * Displays the list of companies in a table format
 * Can be reused in different contexts
 */

'use client'

import { Building2, Eye, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useT, useLocale } from 'shared/src/i18n/react'
import { Company } from '@/lib/api'

interface CompanyListProps {
  companies: Company[]
  onEdit?: (company: Company) => void
  onDelete?: (company: Company) => void
  emptyMessage?: string
}

export function CompanyList({ companies, onEdit, onDelete, emptyMessage }: CompanyListProps) {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

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

  return (
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
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="text-gray-500">
                      {emptyMessage || getText('merchant.b2b.companies.noCompaniesFound', 'No companies found.')}
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((company: Company) => (
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
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.companies.edit', 'Edit')}
                            onClick={() => onEdit(company)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.companies.delete', 'Delete')}
                            onClick={() => onDelete(company)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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
  )
}
