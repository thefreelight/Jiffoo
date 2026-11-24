'use client'

import { PageShell } from '@/components/layout/page-shell'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { SupportHubInboxWorkspace } from '@/components/plugins/SupportHubInboxWorkspace'
import { useWorkspaceText } from '@/components/plugins/use-workspace-text'
import { ADMIN_PERMISSIONS } from 'shared'

export default function SupportConversationsPage() {
  const tf = useWorkspaceText()

  return (
    <ProtectedRoute requiredPermissions={[ADMIN_PERMISSIONS.SUPPORT_READ]}>
      <PageShell
        title={tf('supportTitle', 'Support conversations')}
        description={tf(
          'supportDescription',
          'Read visitor messages and reply as a support agent. Conversations you answer stop using AI replies.',
        )}
      >
        <SupportHubInboxWorkspace installationId="default" />
      </PageShell>
    </ProtectedRoute>
  )
}
