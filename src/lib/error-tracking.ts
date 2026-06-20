/**
 * Error tracking service — placeholder for Sentry integration
 *
 * In production, replace console.error with Sentry.captureException()
 * and add performance monitoring.
 */

export function captureException(error: Error, context?: Record<string, unknown>) {
  // TODO: Replace with Sentry.captureException(error, { extra: context })
  console.error('[error-tracking]', error.message, { stack: error.stack, ...context })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  // TODO: Replace with Sentry.captureMessage(message, level)
  console[level === 'warning' ? 'warn' : level]('[error-tracking]', message)
}

export function startSpan(name: string, fn: () => Promise<void>) {
  // TODO: Replace with Sentry.startSpan({ name }, fn)
  return fn()
}
