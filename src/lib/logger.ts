/**
 * Structured logging service for observability
 *
 * In production, these logs should be sent to a log aggregation service
 * (Datadog, New Relic, Sentry) for monitoring and alerting.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service: string
  traceId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

class Logger {
  private service: string

  constructor(service: string = 'unilag-marketplace') {
    this.service = service
  }

  private format(entry: Omit<LogEntry, 'timestamp' | 'service'>): LogEntry {
    return {
      ...entry,
      timestamp: new Date().toISOString(),
      service: this.service,
    }
  }

  private output(entry: LogEntry) {
    const output = JSON.stringify(entry)
    switch (entry.level) {
      case 'error': console.error(output); break
      case 'warn': console.warn(output); break
      case 'info': console.info(output); break
      default: console.log(output)
    }
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.output(this.format({ level: 'debug', message, metadata }))
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.output(this.format({ level: 'info', message, metadata }))
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.output(this.format({ level: 'warn', message, metadata }))
  }

  error(message: string, metadata?: Record<string, unknown>) {
    this.output(this.format({ level: 'error', message, metadata }))
  }

  withContext(context: { userId?: string; traceId?: string }) {
    const parent = this
    return {
      debug: (message: string, metadata?: Record<string, unknown>) =>
        parent.output(parent.format({ level: 'debug', message, ...context, metadata })),
      info: (message: string, metadata?: Record<string, unknown>) =>
        parent.output(parent.format({ level: 'info', message, ...context, metadata })),
      warn: (message: string, metadata?: Record<string, unknown>) =>
        parent.output(parent.format({ level: 'warn', message, ...context, metadata })),
      error: (message: string, metadata?: Record<string, unknown>) =>
        parent.output(parent.format({ level: 'error', message, ...context, metadata })),
    }
  }
}

export const logger = new Logger()
export { Logger }
