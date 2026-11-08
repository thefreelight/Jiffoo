'use client'

import { PageShell } from '@/components/layout/page-shell'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { SupportHubInboxWorkspace } from '@/components/plugins/SupportHubInboxWorkspace'
import { ADMIN_PERMISSIONS } from 'shared'

export default function SupportConversationsPage() {
  return (
    <ProtectedRoute requiredPermissions={[ADMIN_PERMISSIONS.SUPPORT_READ]}>
      <PageShell>
        <SupportHubInboxWorkspace installationId="default" />
      </PageShell>
    </ProtectedRoute>
  )
}
