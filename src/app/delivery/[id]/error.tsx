'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DeliveryTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[delivery-tracking-error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border border-border p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Tracking Error</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Could not load delivery tracking. The link may be invalid or the delivery may have been removed.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/delivery"
            className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Delivery
          </Link>
        </div>
      </div>
    </div>
  )
}
