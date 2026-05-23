import { createServer } from 'http'
import { parse } from 'url'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectDir = __dirname

async function main() {
  // Validate environment on startup
  try {
    const { checkEnvironment } = await import(resolve(projectDir, 'src/lib/env-check.ts'))
    checkEnvironment()
  } catch {
    // env-check is optional; don't block startup
  }

  const app = next({ dev, hostname, port, dir: projectDir })
  const handle = app.getRequestHandler()

  app.prepare().then(async () => {
    const httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true)
      handle(req, res, parsedUrl)
    })

    try {
      const { initSocketIO } = await import(resolve(projectDir, 'src/lib/socket-server.ts'))
      initSocketIO(httpServer)
      console.log('[server] Socket.io: ENABLED')
    } catch (err) {
      console.warn('[server] Socket.io: DISABLED')
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[server] Error:', msg)
    }

    const shutdown = () => {
      console.log('\n[server] Shutting down gracefully...')
      httpServer.close(() => { process.exit(0) })
      setTimeout(() => { process.exit(1) }, 10000)
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    httpServer.listen(port, hostname, () => {
      console.log(``)
      console.log(`  ┌──────────────────────────────────────────────┐`)
      console.log(`  │  UNILAG Marketplace                         │`)
      console.log(`  │  http://0.0.0.0:${port}                       │`)
      console.log(`  │  Mode: ${dev ? 'DEVELOPMENT' : 'PRODUCTION'}                       │`)
      console.log(`  └──────────────────────────────────────────────┘`)
      console.log(``)
    })
  })
}

main().catch((err) => { console.error('[server] Fatal error:', err); process.exit(1) })
