'use client'

import { PageShell } from '@/components/layout/page-shell'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { SupportInboxWorkspace } from '@/components/support/support-inbox-workspace'
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
          'Pick a conversation to read it and reply as a support agent. Conversations you answer stop using AI replies.',
        )}
      >
        <SupportInboxWorkspace installationId="default" />
      </PageShell>
    </ProtectedRoute>
  )
}
