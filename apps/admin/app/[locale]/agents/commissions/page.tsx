/**
 * Agent Commissions Page
 *
 * Displays commission records for all agents.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, DollarSign, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageNav } from '@/components/layout/page-nav'
import { useQuery } from '@tanstack/react-query'
import { agentAdminApi, type AgentCommission } from '@/lib/agent-api'
import { useAuthStore } from '@/lib/store'
import { useT } from 'shared/src/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AgentCommissionsPage() {
  const t = useT()
  const { tenantInfo } = useAuthStore()
  const tenantId = parseInt(tenantInfo?.id || '0')

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const navItems = [
    { label: getText('tenant.agent.allAgents', 'All Agents'), href: '/agents', exact: true },
    { label: getText('tenant.agent.levelConfig', 'Level Config'), href: '/agents/levels' },
    { label: getText('tenant.agent.commissions', 'Commissions'), href: '/agents/commissions' },
  ]

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: commissionsData, isLoading, error } = useQuery({
    queryKey: ['agent-commissions', tenantId, statusFilter, currentPage],
    queryFn: async () => {
      const params = {
        page: currentPage,
        limit: 20,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }
      const response = await agentAdminApi.getCommissions(tenantId, params)
      return response.data
    },
    enabled: tenantId > 0,
  })

  const commissions = commissionsData?.data || []
  const pagination = commissionsData?.pagination

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SETTLED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{getText('tenant.agent.settled', 'Settled')}</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />{getText('tenant.agent.pending', 'Pending')}</Badge>
      case 'PAID':
        return <Badge className="bg-blue-100 text-blue-800"><DollarSign className="w-3 h-3 mr-1" />{getText('tenant.agent.paid', 'Paid')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.agent.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.agent.loadError', 'Failed to load commissions')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.agent.commissionsTitle', 'Commission Records')}</h1>
            <p className="text-gray-600 mt-1">{getText('tenant.agent.commissionsSubtitle', 'View all agent commission transactions')}</p>
          </div>
        </div>
        <PageNav items={navItems} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={getText('tenant.agent.filterStatus', 'Filter by status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getText('tenant.agent.allStatus', 'All Status')}</SelectItem>
            <SelectItem value="PENDING">{getText('tenant.agent.pending', 'Pending')}</SelectItem>
            <SelectItem value="SETTLED">{getText('tenant.agent.settled', 'Settled')}</SelectItem>
            <SelectItem value="PAID">{getText('tenant.agent.paid', 'Paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Commission List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.agentName', 'Agent')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.orderId', 'Order ID')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.orderAmount', 'Order Amount')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.rate', 'Rate')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.commissionAmount', 'Commission')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.date', 'Date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">{getText('tenant.agent.noCommissions', 'No commission records found')}</p>
                    </td>
                  </tr>
                ) : (
                  commissions.map((commission: AgentCommission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{commission.agent?.name || '-'}</div>
                        <div className="text-sm text-gray-500">L{commission.agentLevel}</div>
                      </td>
                      <td className="py-4 px-6 font-mono text-sm">{commission.orderId.slice(0, 8)}...</td>
                      <td className="py-4 px-6">${commission.orderAmount?.toLocaleString()}</td>
                      <td className="py-4 px-6">{commission.rate}%</td>
                      <td className="py-4 px-6 font-medium text-green-600">${commission.amount?.toLocaleString()}</td>
                      <td className="py-4 px-6">{getStatusBadge(commission.status)}</td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {new Date(commission.createdAt).toLocaleDateString()}
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
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('tenant.agent.showingPage', 'Page')} {pagination.page} / {pagination.totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              {getText('tenant.agent.previous', 'Previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('tenant.agent.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

