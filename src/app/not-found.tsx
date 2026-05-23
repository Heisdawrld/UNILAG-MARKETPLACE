import Link from 'next/link'
import { Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border border-border p-8 text-center">
        <h1 className="text-6xl font-bold text-muted-foreground/20 mb-4">404</h1>
        <h2 className="text-xl font-bold text-foreground mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            href="/?tab=search"
            className="flex items-center gap-2 bg-muted text-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Search className="w-4 h-4" />
            Browse Listings
          </Link>
        </div>
      </div>
    </div>
  )
}
