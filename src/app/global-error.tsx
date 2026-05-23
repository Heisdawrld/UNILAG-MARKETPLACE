'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Detect dark mode via media query (can't rely on Tailwind/theme in global error boundary)
  const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

  const bg = isDark ? '#09090b' : '#fafafa'
  const cardBg = isDark ? '#18181b' : '#ffffff'
  const text = isDark ? '#fafafa' : '#18181b'
  const muted = isDark ? '#a1a1aa' : '#71717a'
  const border = isDark ? '#27272a' : '#e4e4e7'
  const primary = isDark ? '#dc6b7c' : '#6B1D2A'
  const primaryFg = isDark ? '#09090b' : '#ffffff'

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: bg,
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              backgroundColor: cardBg,
              borderRadius: '1rem',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
              border: `1px solid ${border}`,
              padding: '2rem',
            }}
          >
            <div
              style={{
                width: '4rem',
                height: '4rem',
                backgroundColor: isDark ? '#451a1a' : '#fef2f2',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: text, marginBottom: '0.5rem' }}>
              Something went wrong!
            </h2>
            <p style={{ color: muted, marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.75rem', color: muted, marginBottom: '1rem', fontFamily: 'monospace', opacity: 0.6 }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: primary,
                  color: primaryFg,
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding: '0.625rem 1.25rem',
                  background: isDark ? '#27272a' : '#f4f4f5',
                  color: text,
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
