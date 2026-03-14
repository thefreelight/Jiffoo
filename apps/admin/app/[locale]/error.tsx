'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from 'shared/src/i18n/react'
import { resolveApiErrorMessage } from '@/lib/error-utils'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const t = useT()

    const getText = (key: string, fallback: string): string => {
        if (!t) return fallback
        const translated = t(key)
        return translated === key ? fallback : translated
    }

    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Error:', error)
    }, [error])

    return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {getText('common.errors.general', 'Something went wrong. Please try again.')}
                </h2>
                <p className="text-gray-600 mb-6">
                    {resolveApiErrorMessage(error, t)}
                </p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={reset} variant="default">
                        {getText('common.actions.retry', 'Retry')}
                    </Button>
                    <Button onClick={() => window.location.href = '/'} variant="outline">
                        {getText('common.actions.goHome', 'Go Home')}
                    </Button>
                </div>
                {error.digest && (
                    <p className="text-xs text-gray-400 mt-4">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
        </div>
    )
}
