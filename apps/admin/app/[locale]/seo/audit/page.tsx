/**
 * SEO Audit Page
 *
 * Displays SEO issues and missing meta tags for products and categories
 */

'use client'

import { useState } from 'react'
import { Search, FileSearch, AlertTriangle } from 'lucide-react'
import { SeoAuditPanel } from '@/components/seo/SeoAuditPanel'
import { Button } from '@/components/ui/button'
import { useT } from 'shared/src/i18n/react'
import { seoAuditApi, unwrapApiResponse, type SeoIssue } from '@/lib/api'
import { toast } from 'sonner'

// Map API severity to panel issue type
const severityToType = (severity: 'critical' | 'warning' | 'info'): 'error' | 'warning' | 'info' => {
  if (severity === 'critical') return 'error'
  return severity
}

// Convert API issues to panel format
const convertIssues = (apiIssues: SeoIssue[]): Array<{
  id: string
  type: 'error' | 'warning' | 'info'
  entity: string
  entityType: 'product' | 'category'
  issue: string
  recommendation: string
}> => {
  return apiIssues.map(issue => ({
    id: issue.id,
    type: severityToType(issue.severity),
    entity: issue.entity.name,
    entityType: issue.entity.type,
    issue: issue.message,
    recommendation: issue.recommendation || '',
  }))
}

export default function SeoAuditPage() {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState<Array<{
    id: string
    type: 'error' | 'warning' | 'info'
    entity: string
    entityType: 'product' | 'category'
    issue: string
    recommendation: string
  }>>([])

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Run SEO audit
  const handleRunAudit = async () => {
    setLoading(true)
    try {
      const response = await seoAuditApi.runAudit({
        includeProducts: true,
        includeCategories: true,
        limit: 100,
      })
      const auditResult = unwrapApiResponse(response)
      const convertedIssues = convertIssues(auditResult.issues)
      setIssues(convertedIssues)

      if (convertedIssues.length === 0) {
        toast.success('No SEO issues found! All products and categories have proper SEO metadata.')
      } else {
        toast.success(`Audit complete: Found ${auditResult.summary.totalIssues} issues`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to run SEO audit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileSearch className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">
              {getText('admin.seo.audit.title', 'SEO Audit')}
            </h1>
          </div>
          <p className="text-[#64748B]">
            {getText('admin.seo.audit.subtitle', 'Identify and fix SEO issues across your products and categories')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAudit}
            disabled={loading}
            className="border-[#E2E8F0] text-[#0F172A] hover:border-[#3B82F6] hover:text-[#3B82F6]"
          >
            <Search className="w-4 h-4 mr-2" />
            {loading ? getText('admin.seo.audit.running', 'Running...') : getText('admin.seo.audit.runAudit', 'Run Audit')}
          </Button>
          <Button
            size="sm"
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            disabled={issues.length === 0}
          >
            {getText('admin.seo.audit.export', 'Export Report')}
          </Button>
        </div>
      </div>

      {/* Audit Panel */}
      <SeoAuditPanel issues={issues} loading={loading} />
    </div>
  )
}
