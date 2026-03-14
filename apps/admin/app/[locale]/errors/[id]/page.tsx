/**
 * Error Detail Page for Admin Application
 *
 * Displays detailed information about a specific error log.
 * Supports i18n through the translation function.
 */

'use client'

import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useError, useResolveError } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { ErrorDetail } from '@/components/error-detail'

export default function ErrorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const errorId = params.id as string
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const { data: error, isLoading, error: fetchError, refetch } = useError(errorId)
  const resolveErrorMutation = useResolveError()

  const handleResolve = async () => {
    if (!error) return

    try {
      await resolveErrorMutation.mutateAsync({
        id: error.id,
        resolved: !error.resolved,
      })
      refetch()
    } catch (err) {
      // Error is handled by the mutation
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{getText('merchant.errors.loadingDetail', 'Loading error details...')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (fetchError || !error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{getText('merchant.errors.errorNotFound', 'Error Not Found')}</h2>
            <p className="text-gray-600 mb-6">{getText('merchant.errors.errorNotFoundDesc', "The error log you're looking for doesn't exist or has been deleted.")}</p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {getText('merchant.errors.goBack', 'Go Back')}
              </Button>
              <Button onClick={() => refetch()}>
                {getText('merchant.errors.retry', 'Retry')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.errors.errorDetails', 'Error Details')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.errors.errorDetailsSubtitle', 'View and manage error information')}</p>
          </div>
        </div>
      </div>

      {/* Error Detail Component */}
      <ErrorDetail
        error={error}
        onResolve={handleResolve}
        isResolving={resolveErrorMutation.isPending}
      />
    </div>
  )
}
