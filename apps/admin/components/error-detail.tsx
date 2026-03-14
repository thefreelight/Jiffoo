/**
 * Error Detail Component
 *
 * Displays detailed information about a specific error log.
 * Shows stack trace, request context, and resolution controls.
 */

'use client'

import { AlertTriangle, CheckCircle, Clock, Code, Globe, Server, User, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { useT } from 'shared/src/i18n/react'
import { ErrorLog } from '@/lib/types'

interface ErrorDetailProps {
  error: ErrorLog
  onResolve: () => void
  isResolving?: boolean
}

export function ErrorDetail({ error, onResolve, isResolving }: ErrorDetailProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      case 'ERROR':
        return 'bg-orange-100 text-orange-800'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'INFO':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'ERROR':
        return <XCircle className="w-5 h-5" />
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5" />
      case 'INFO':
        return <CheckCircle className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={getSeverityColor(error.severity)} variant="secondary">
                  <div className="flex items-center space-x-1">
                    {getSeverityIcon(error.severity)}
                    <span className="font-medium">{error.severity}</span>
                  </div>
                </Badge>
                {error.resolved ? (
                  <Badge className="bg-green-100 text-green-800" variant="secondary">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {getText('merchant.errors.resolved', 'Resolved')}
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                    {getText('merchant.errors.unresolved', 'Unresolved')}
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 break-words">{error.message}</h2>
              {error.statusCode && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Code className="w-4 h-4" />
                  <span>HTTP {error.statusCode}</span>
                </div>
              )}
            </div>
            {!error.resolved && (
              <Button
                onClick={onResolve}
                disabled={isResolving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isResolving ? getText('merchant.errors.resolving', 'Resolving...') : getText('merchant.errors.markResolved', 'Mark as Resolved')}
              </Button>
            )}
            {error.resolved && (
              <Button
                onClick={onResolve}
                disabled={isResolving}
                variant="outline"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {isResolving ? getText('merchant.errors.unresolving', 'Unresolving...') : getText('merchant.errors.markUnresolved', 'Mark as Unresolved')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.errors.occurrences', 'Occurrences')}</p>
                <p className="text-2xl font-bold text-gray-900">{error.occurrenceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.errors.firstSeen', 'First Seen')}</p>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(error.firstSeenAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.errors.lastSeen', 'Last Seen')}</p>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(error.lastSeenAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Server className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.errors.environment', 'Environment')}</p>
                <p className="text-sm font-medium text-gray-900">{error.environment || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request Context */}
      {(error.path || error.method) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {getText('merchant.errors.requestContext', 'Request Context')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error.method && error.path && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{getText('merchant.errors.endpoint', 'Endpoint')}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {error.method}
                  </Badge>
                  <code className="text-sm bg-gray-100 px-3 py-1 rounded">{error.path}</code>
                </div>
              </div>
            )}
            {error.requestContext && (
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{getText('merchant.errors.additionalContext', 'Additional Context')}</p>
                <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto border border-gray-200">
                  {JSON.stringify(error.requestContext, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Info */}
      {(error.userId || error.username) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {getText('merchant.errors.userInfo', 'User Information')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {error.username && (
              <div>
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.username', 'Username')}</p>
                <p className="text-base text-gray-900">{error.username}</p>
              </div>
            )}
            {error.userId && (
              <div>
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.userId', 'User ID')}</p>
                <p className="text-xs text-gray-500 font-mono">{error.userId}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stack Trace */}
      {error.stack && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              {getText('merchant.errors.stackTrace', 'Stack Trace')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Resolution Info */}
      {error.resolved && error.resolvedAt && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">
                  {getText('merchant.errors.resolvedOn', 'Resolved on')} {format(new Date(error.resolvedAt), 'MMM d, yyyy HH:mm')}
                </p>
                {error.resolvedBy && (
                  <p className="text-sm text-green-700">
                    {getText('merchant.errors.resolvedBy', 'Resolved by')}: {error.resolvedBy}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">{getText('merchant.errors.errorId', 'Error ID')}</p>
              <p className="font-mono text-gray-900 text-xs break-all">{error.id}</p>
            </div>
            <div>
              <p className="text-gray-600">{getText('merchant.errors.errorHash', 'Error Hash')}</p>
              <p className="font-mono text-gray-900 text-xs break-all">{error.errorHash}</p>
            </div>
            {error.storeId && (
              <div>
                <p className="text-gray-600">{getText('merchant.errors.storeId', 'Store ID')}</p>
                <p className="font-mono text-gray-900 text-xs break-all">{error.storeId}</p>
              </div>
            )}
            {error.storeName && (
              <div>
                <p className="text-gray-600">{getText('merchant.errors.storeName', 'Store Name')}</p>
                <p className="text-gray-900">{error.storeName}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
