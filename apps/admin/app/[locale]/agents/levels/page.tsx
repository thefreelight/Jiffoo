/**
 * Agent Level Configuration Page
 *
 * Allows tenants to configure commission rates and limits for each agent level.
 */

'use client'

import { useState } from 'react'
import { AlertTriangle, Percent, Save, Settings, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageNav } from '@/components/layout/page-nav'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentAdminApi, type AgentLevelConfig, type UpdateLevelConfigRequest } from '@/lib/agent-api'
import { useAuthStore } from '@/lib/store'
import { useT } from 'shared/src/i18n'

export default function AgentLevelsPage() {
  const t = useT()
  const queryClient = useQueryClient()
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

  const [editingLevel, setEditingLevel] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<UpdateLevelConfigRequest>({
    commissionRate: 0,
    maxAgentsPerParent: 10,
  })

  const { data: levelConfigs, isLoading, error } = useQuery({
    queryKey: ['agent-levels', tenantId],
    queryFn: async () => {
      const response = await agentAdminApi.getLevelConfigs(tenantId)
      return response.data || []
    },
    enabled: tenantId > 0,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ level, data }: { level: number; data: UpdateLevelConfigRequest }) => {
      return agentAdminApi.updateLevelConfig(tenantId, level, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-levels', tenantId] })
      setEditingLevel(null)
    },
  })

  const handleEdit = (config: AgentLevelConfig) => {
    setEditingLevel(config.level)
    setEditForm({
      commissionRate: config.commissionRate,
      maxAgentsPerParent: config.maxAgentsPerParent,
      maxProducts: config.maxProducts,
      l1ShareRate: config.l1ShareRate,
      l2ShareRate: config.l2ShareRate,
      l3ShareRate: config.l3ShareRate,
    })
  }

  const handleSave = () => {
    if (editingLevel === null) return
    updateMutation.mutate({ level: editingLevel, data: editForm })
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
          <p className="text-gray-600">{getText('tenant.agent.loadError', 'Failed to load level configs')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.agent.levelConfigTitle', 'Level Configuration')}</h1>
            <p className="text-gray-600 mt-1">{getText('tenant.agent.levelConfigSubtitle', 'Configure commission rates for each agent level')}</p>
          </div>
        </div>
        <PageNav items={navItems} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(levelConfigs || []).map((config: AgentLevelConfig) => (
          <Card key={config.level}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {getText('tenant.agent.level', 'Level')} {config.level}
              </CardTitle>
              <CardDescription>{getText('tenant.agent.levelConfigDesc', 'Commission and limits settings')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingLevel === config.level ? (
                <>
                  <div className="space-y-2">
                    <Label>{getText('tenant.agent.commissionRate', 'Commission Rate (%)')}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editForm.commissionRate}
                      onChange={(e) => setEditForm({ ...editForm, commissionRate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{getText('tenant.agent.maxAgents', 'Max Agents Per Parent')}</Label>
                    <Input
                      type="number"
                      value={editForm.maxAgentsPerParent || ''}
                      onChange={(e) => setEditForm({ ...editForm, maxAgentsPerParent: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                      <Save className="w-4 h-4 mr-1" />
                      {updateMutation.isPending ? getText('tenant.agent.saving', 'Saving...') : getText('tenant.agent.save', 'Save')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingLevel(null)}>
                      {getText('tenant.agent.cancel', 'Cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{getText('tenant.agent.commissionRate', 'Commission Rate')}</span>
                    <span className="font-medium flex items-center"><Percent className="w-3 h-3 mr-1" />{config.commissionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{getText('tenant.agent.maxAgents', 'Max Agents')}</span>
                    <span className="font-medium flex items-center"><Users className="w-3 h-3 mr-1" />{config.maxAgentsPerParent}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(config)} className="w-full">
                    {getText('tenant.agent.edit', 'Edit')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

