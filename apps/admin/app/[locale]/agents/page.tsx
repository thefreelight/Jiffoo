/**
 * Agent Management Page for Tenant Application
 *
 * Displays agent list with management capabilities.
 * Only accessible when agent plugin is installed.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Eye, Search, UserCog, UserPlus, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageNav } from '@/components/layout/page-nav'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentAdminApi, type Agent } from '@/lib/agent-api'
import { useAuthStore } from '@/lib/store'
import { useT } from 'shared/src/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AgentsPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { tenantInfo } = useAuthStore()
  const tenantId = parseInt(tenantInfo?.id || '0')

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items
  const navItems = [
    { label: getText('tenant.agent.allAgents', 'All Agents'), href: '/agents', exact: true },
    { label: getText('tenant.agent.levelConfig', 'Level Config'), href: '/agents/levels' },
    { label: getText('tenant.agent.commissions', 'Commissions'), href: '/agents/commissions' },
  ]

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'REJECTED'>('ACTIVE')

  // Fetch agents
  const { data: agents, isLoading, error } = useQuery({
    queryKey: ['agents', tenantId, statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined
      const response = await agentAdminApi.getAgents(tenantId, params)
      return response.data || []
    },
    enabled: tenantId > 0,
  })

  // Update agent status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ agentId, status }: { agentId: string; status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' }) => {
      return agentAdminApi.updateAgentStatus(tenantId, agentId, status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', tenantId] })
      setStatusDialogOpen(false)
      setSelectedAgent(null)
    },
  })

  const handleOpenStatusDialog = (agent: Agent) => {
    setSelectedAgent(agent)
    setNewStatus(agent.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
    setStatusDialogOpen(true)
  }

  const handleUpdateStatus = () => {
    if (!selectedAgent) return
    updateStatusMutation.mutate({ agentId: selectedAgent.id, status: newStatus })
  }

  const filteredAgents = (agents || []).filter((agent: Agent) => {
    if (!searchTerm) return true
    return (
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{getText('tenant.agent.statusActive', 'Active')}</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />{getText('tenant.agent.statusPending', 'Pending')}</Badge>
      case 'SUSPENDED':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />{getText('tenant.agent.statusSuspended', 'Suspended')}</Badge>
      case 'REJECTED':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />{getText('tenant.agent.statusRejected', 'Rejected')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.agent.loading', 'Loading agents...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.agent.loadError', 'Failed to load agents')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.agent.title', 'Agent Management')}</h1>
            <p className="text-gray-600 mt-1">{getText('tenant.agent.subtitle', 'Manage your distribution agents')}</p>
          </div>
          <Button className="bg-gray-900 hover:bg-gray-800">
            <UserPlus className="w-4 h-4 mr-2" />
            {getText('tenant.agent.addAgent', 'Add Agent')}
          </Button>
        </div>
        <PageNav items={navItems} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.agent.totalAgents', 'Total Agents')}</CardTitle>
            <UserCog className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.agent.activeAgents', 'Active')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {agents?.filter((a: Agent) => a.status === 'ACTIVE').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.agent.pendingAgents', 'Pending')}</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {agents?.filter((a: Agent) => a.status === 'PENDING').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.agent.suspendedAgents', 'Suspended')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {agents?.filter((a: Agent) => a.status === 'SUSPENDED').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder={getText('tenant.agent.searchPlaceholder', 'Search agents...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={getText('tenant.agent.filterStatus', 'Filter by status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getText('tenant.agent.allStatus', 'All Status')}</SelectItem>
            <SelectItem value="ACTIVE">{getText('tenant.agent.statusActive', 'Active')}</SelectItem>
            <SelectItem value="PENDING">{getText('tenant.agent.statusPending', 'Pending')}</SelectItem>
            <SelectItem value="SUSPENDED">{getText('tenant.agent.statusSuspended', 'Suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agent List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.agentName', 'Agent')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.code', 'Code')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.level', 'Level')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.totalSales', 'Total Sales')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.commission', 'Commission')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.agent.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">{getText('tenant.agent.noAgents', 'No agents found')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent: Agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-full mr-4 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{agent.name}</div>
                            <div className="text-sm text-gray-500">{agent.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-sm">{agent.code}</td>
                      <td className="py-4 px-6">
                        <Badge variant="outline">L{agent.level}</Badge>
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(agent.status)}</td>
                      <td className="py-4 px-6">${agent.totalSales?.toLocaleString() || '0'}</td>
                      <td className="py-4 px-6">${agent.totalCommission?.toLocaleString() || '0'}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" title={getText('tenant.agent.viewDetails', 'View Details')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(agent)}
                            title={getText('tenant.agent.changeStatus', 'Change Status')}
                          >
                            {agent.status === 'ACTIVE' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
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

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('tenant.agent.changeStatusTitle', 'Change Agent Status')}</DialogTitle>
            <DialogDescription>
              {getText('tenant.agent.changeStatusDesc', 'Update the status for')} {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={(v: 'ACTIVE' | 'SUSPENDED' | 'REJECTED') => setNewStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{getText('tenant.agent.statusActive', 'Active')}</SelectItem>
                <SelectItem value="SUSPENDED">{getText('tenant.agent.statusSuspended', 'Suspended')}</SelectItem>
                <SelectItem value="REJECTED">{getText('tenant.agent.statusRejected', 'Rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              {getText('tenant.agent.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? getText('tenant.agent.saving', 'Saving...') : getText('tenant.agent.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

