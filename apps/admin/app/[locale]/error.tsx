'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Error:', error)
    }, [error])

    return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Something went wrong!
                </h2>
                <p className="text-gray-600 mb-6">
                    {error.message || 'An unexpected error occurred. Please try again.'}
                </p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={reset} variant="default">
                        Try again
                    </Button>
                    <Button onClick={() => window.location.href = '/'} variant="outline">
                        Go to Dashboard
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
