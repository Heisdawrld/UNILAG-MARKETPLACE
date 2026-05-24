'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, ShieldCheck, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function PaymentLockedContent() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          {/* Lock Icon */}
          <div className="mx-auto w-20 h-20 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-amber-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Payments Coming Soon
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            We&#39;re setting up the official UNILAG Marketplace payment system.
            Payments will be available once our Flutterwave account is fully verified.
          </p>

          {/* Security Badge */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-green-800">Your account is secure</p>
              <p className="text-xs text-green-600 mt-1">
                No charges have been made. All payment features are locked until the official account is activated.
              </p>
            </div>
          </div>

          {/* Reference */}
          {ref && (
            <p className="text-xs text-gray-400 mb-4 font-mono">
              Reference: {ref}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>

            <p className="text-xs text-gray-400">
              Redirecting automatically in {countdown}s...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentLockedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    }>
      <PaymentLockedContent />
    </Suspense>
  )
}
